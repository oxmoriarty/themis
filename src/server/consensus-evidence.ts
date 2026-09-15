import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { stageConsensusEvidenceSchema } from "@/server/api-schemas";
import { sha256 } from "@/server/evidence";
import { ApiError } from "@/server/errors";

/**
 * This stores an acknowledged public-text staging record only. It does not
 * submit a transaction and must never be presented as validator-visible until
 * a caller-owned GenLayer write has reached the appropriate chain state.
 */
export async function stageConsensusEvidence(
  client: SupabaseClient,
  matterId: string,
  walletIdentityId: string,
  rawInput: z.input<typeof stageConsensusEvidenceSchema>,
) {
  const input = stageConsensusEvidenceSchema.parse(rawInput);
  const { data, error } = await client.rpc("create_consensus_evidence_entry", {
    p_matter_id: matterId,
    p_public_text: input.publicText,
    p_text_sha256: sha256(new TextEncoder().encode(input.publicText)),
    p_wallet_identity_id: walletIdentityId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error?.code === "P0001") {
    throw new ApiError(409, "CONSENSUS_EVIDENCE_LIMIT", "This matter has reached its public-evidence limit.");
  }
  if (error || !data) {
    throw new ApiError(500, "DATABASE_ERROR", "The public evidence staging record could not be created.");
  }
  return data;
}
