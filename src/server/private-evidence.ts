import type { SupabaseClient } from "@supabase/supabase-js";

import type { EvidenceUploadInput, PreparedEvidenceUpload } from "@/server/evidence";
import { prepareEvidenceUpload } from "@/server/evidence";
import { ApiError } from "@/server/errors";

export const PRIVATE_EVIDENCE_BUCKET = "evidence-private";
const SIGNED_URL_TTL_SECONDS = 60;

export type PrivateEvidenceRecord = {
  id: string;
  original_filename: string;
  mime_type: string;
  detected_mime_type: string;
  byte_size: number;
  sha256: string;
  uploaded_at: string;
  processing_status: "PENDING_REVIEW" | "REJECTED" | "READY";
};

export async function storePrivateEvidence(
  client: SupabaseClient,
  input: EvidenceUploadInput,
  uploadedByWalletId: string,
): Promise<PrivateEvidenceRecord> {
  const prepared = prepareEvidenceUpload(input);
  const { error: uploadError } = await client.storage
    .from(PRIVATE_EVIDENCE_BUCKET)
    .upload(prepared.objectPath, prepared.bytes, {
      contentType: prepared.detectedMimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new ApiError(502, "STORAGE_UPLOAD_FAILED", "The private evidence file could not be stored.");
  }

  try {
    const { data, error } = await client
      .from("evidence_files")
      .insert({
        matter_id: input.matterId,
        storage_object_path: prepared.objectPath,
        original_filename: prepared.originalFilename,
        mime_type: prepared.declaredMimeType,
        detected_mime_type: prepared.detectedMimeType,
        byte_size: prepared.byteSize,
        sha256: prepared.sha256,
        uploaded_by_wallet_id: uploadedByWalletId,
        processing_status: "PENDING_REVIEW",
        provenance: {
          received_via: "API_UPLOAD",
          original_sha256: prepared.sha256,
          signature_verified: true,
        },
      })
      .select("id, original_filename, mime_type, detected_mime_type, byte_size, sha256, uploaded_at, processing_status")
      .single();

    if (error || !data) {
      throw new ApiError(500, "DATABASE_ERROR", "Evidence metadata could not be recorded.");
    }
    return data as PrivateEvidenceRecord;
  } catch (error) {
    await client.storage.from(PRIVATE_EVIDENCE_BUCKET).remove([prepared.objectPath]);
    throw error;
  }
}

export async function createPrivateEvidenceDownloadUrl(
  client: SupabaseClient,
  matterId: string,
  evidenceId: string,
): Promise<{ signedUrl: string; expiresInSeconds: number }> {
  const { data: evidence, error } = await client
    .from("evidence_files")
    .select("storage_object_path, processing_status")
    .eq("id", evidenceId)
    .eq("matter_id", matterId)
    .maybeSingle();

  if (error) throw new ApiError(500, "DATABASE_ERROR", "Evidence metadata could not be read.");
  if (!evidence) throw new ApiError(404, "EVIDENCE_NOT_FOUND", "The evidence file was not found.");
  if ((evidence as { processing_status: string }).processing_status !== "READY") {
    throw new ApiError(
      423,
      "EVIDENCE_PENDING_REVIEW",
      "This unscanned original is not available for download until it has been reviewed.",
    );
  }

  const { data: signed, error: signedError } = await client.storage
    .from(PRIVATE_EVIDENCE_BUCKET)
    .createSignedUrl((evidence as { storage_object_path: string }).storage_object_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    throw new ApiError(502, "SIGNED_URL_FAILED", "A private evidence link could not be created.");
  }
  return { signedUrl: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS };
}

export function preparedEvidenceMetadata(prepared: PreparedEvidenceUpload) {
  return {
    originalFilename: prepared.originalFilename,
    detectedMimeType: prepared.detectedMimeType,
    byteSize: prepared.byteSize,
    sha256: prepared.sha256,
  };
}
