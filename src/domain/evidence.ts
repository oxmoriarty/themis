import { z } from "zod";

import { hash256Schema, uuidSchema, walletAddressSchema } from "@/domain/identifiers";

export const privateEvidenceMimeTypes = [
  "text/plain",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const privateEvidenceMimeTypeSchema = z.enum(privateEvidenceMimeTypes);

export const evidenceFileSchema = z.object({
  id: uuidSchema,
  matterId: uuidSchema,
  objectPath: z.string().min(1).max(512),
  originalFilename: z.string().min(1).max(255),
  mimeType: privateEvidenceMimeTypeSchema,
  byteSize: z.number().int().positive(),
  sha256: hash256Schema,
  uploadedBy: walletAddressSchema,
  uploadedAt: z.coerce.date(),
  extractedTextSha256: hash256Schema.nullable(),
});

export type EvidenceFile = z.infer<typeof evidenceFileSchema>;

/**
 * These limits are a Themis product control, not a GenLayer documented limit.
 * Contract implementation must confirm compatible limits before use.
 */
export const provisionalConsensusEvidenceLimits = {
  maxEntriesPerMatter: 12,
  maxTextCharactersPerEntry: 12_000,
} as const;

export const consensusEvidenceEntrySchema = z.object({
  id: uuidSchema,
  matterId: uuidSchema,
  entryIndex: z.number().int().nonnegative(),
  text: z.string().trim().min(1).max(provisionalConsensusEvidenceLimits.maxTextCharactersPerEntry),
  textSha256: hash256Schema,
  submittedBy: walletAddressSchema,
  promotionAcknowledgedAt: z.coerce.date(),
  onchainTransactionHash: z.string().nullable(),
});

export type ConsensusEvidenceEntry = z.infer<typeof consensusEvidenceEntrySchema>;

export function isEligibleForConsensusPromotion(file: Pick<EvidenceFile, "mimeType">): boolean {
  return file.mimeType === "text/plain";
}

