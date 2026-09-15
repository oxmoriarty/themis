import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createMatterDraftSchema } from "@/server/api-schemas";
import { requireMatterAccess } from "@/server/supabase";
import { ApiError } from "@/server/errors";

export async function createMatterDraft(
  client: SupabaseClient,
  userId: string,
  rawInput: z.input<typeof createMatterDraftSchema>,
) {
  const input = createMatterDraftSchema.parse(rawInput);
  const access = await requireWalletIdentity(client, userId);
  const { data, error } = await client.rpc("create_matter_draft", {
    p_client_wallet_identity_id: access,
    p_provider_wallet_address: input.providerWalletAddress,
    p_service_id: input.serviceId,
    p_title: input.title,
    p_private_description: input.privateDescription,
  });

  if (error?.code === "P0001") {
    throw new ApiError(400, "INVALID_MATTER_DRAFT", "The provider or service is not available for this draft.");
  }
  if (error || !data) {
    throw new ApiError(500, "DATABASE_ERROR", "The matter draft could not be created.");
  }
  return data;
}

export async function requireWalletIdentity(client: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await client
    .from("wallet_identities")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new ApiError(500, "DATABASE_ERROR", "Could not resolve the verified wallet.");
  if (!data) throw new ApiError(403, "WALLET_NOT_VERIFIED", "Verify a wallet before creating a matter.");
  return (data as { id: string }).id;
}

export { requireMatterAccess };
