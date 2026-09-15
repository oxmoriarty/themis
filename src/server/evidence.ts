import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import { privateEvidenceMimeTypeSchema } from "@/domain/evidence";
import { uuidSchema } from "@/domain/identifiers";
import { ApiError } from "@/server/errors";

export const MAX_PRIVATE_EVIDENCE_BYTES = 5 * 1024 * 1024;

const webpMagic = new TextEncoder().encode("WEBP");
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export const evidenceUploadInputSchema = z.object({
  matterId: uuidSchema,
  originalFilename: z.string().min(1).max(255),
  declaredMimeType: privateEvidenceMimeTypeSchema,
  bytes: z.instanceof(Uint8Array),
});

// The browser supplied Content-Type is an untrusted string. Parsing occurs in
// prepareEvidenceUpload before it can become metadata.
export type EvidenceUploadInput = {
  matterId: string;
  originalFilename: string;
  declaredMimeType: string;
  bytes: Uint8Array;
};

export type PreparedEvidenceUpload = {
  objectPath: string;
  originalFilename: string;
  declaredMimeType: z.infer<typeof privateEvidenceMimeTypeSchema>;
  detectedMimeType: z.infer<typeof privateEvidenceMimeTypeSchema>;
  byteSize: number;
  sha256: string;
  bytes: Uint8Array;
};

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function isTextPlain(bytes: Uint8Array): boolean {
  try {
    const decoded = textDecoder.decode(bytes);
    return ![...decoded].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    });
  } catch {
    return false;
  }
}

export function detectEvidenceMimeType(
  bytes: Uint8Array,
): z.infer<typeof privateEvidenceMimeTypeSchema> | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    webpMagic.every((value, index) => bytes[index + 8] === value)
  ) return "image/webp";
  if (isTextPlain(bytes)) return "text/plain";
  return null;
}

export function normalizeEvidenceFilename(input: string): string {
  const basename = input.replace(/\\/g, "/").split("/").pop() ?? "";
  const normalized = basename
    .normalize("NFKC")
    .split("")
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return (normalized || "evidence").slice(0, 255);
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function prepareEvidenceUpload(input: EvidenceUploadInput): PreparedEvidenceUpload {
  const parsed = evidenceUploadInputSchema.parse(input);
  const bytes = parsed.bytes;

  if (bytes.byteLength === 0) {
    throw new ApiError(400, "EMPTY_EVIDENCE", "Evidence files cannot be empty.");
  }
  if (bytes.byteLength > MAX_PRIVATE_EVIDENCE_BYTES) {
    throw new ApiError(
      413,
      "EVIDENCE_TOO_LARGE",
      `Evidence is limited to ${MAX_PRIVATE_EVIDENCE_BYTES} bytes on this free-tier deployment.`,
    );
  }

  const detectedMimeType = detectEvidenceMimeType(bytes);
  if (!detectedMimeType) {
    throw new ApiError(415, "UNSUPPORTED_EVIDENCE", "The file signature is not an allowed evidence type.");
  }
  if (detectedMimeType !== parsed.declaredMimeType) {
    throw new ApiError(415, "EVIDENCE_TYPE_MISMATCH", "The declared MIME type does not match the file signature.");
  }

  return {
    objectPath: `${parsed.matterId}/${randomUUID()}`,
    originalFilename: normalizeEvidenceFilename(parsed.originalFilename),
    declaredMimeType: parsed.declaredMimeType,
    detectedMimeType,
    byteSize: bytes.byteLength,
    sha256: sha256(bytes),
    bytes,
  };
}
