import { z } from "zod";

import { createMatterRequestSchema } from "@/api/contracts";
import { provisionalConsensusEvidenceLimits } from "@/domain/evidence";
import { uuidSchema, walletAddressSchema } from "@/domain/identifiers";

export const createMatterDraftSchema = createMatterRequestSchema;

export const stageConsensusEvidenceSchema = z.object({
  publicText: z
    .string()
    .trim()
    .min(1)
    .max(provisionalConsensusEvidenceLimits.maxTextCharactersPerEntry),
  promotionAcknowledged: z.literal(true),
  idempotencyKey: uuidSchema,
});

export function parseConfiguredAppOrigin(): string {
  const origin = z.string().url().parse(process.env.THEMIS_APP_ORIGIN);
  return new URL(origin).origin;
}

export function getChallengeTtlSeconds(): number {
  return z.coerce.number().int().min(60).max(900).parse(process.env.THEMIS_AUTH_CHALLENGE_TTL_SECONDS ?? 300);
}
