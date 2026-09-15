import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { AuthenticationError, AuthorizationError, ApiError } from "@/server/errors";

const serverSupabaseConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
  serviceRoleKey: z.string().min(1),
});

export type MatterAccess = {
  walletIdentityId: string;
  role: "CLIENT" | "PROVIDER";
};

export function getServerSupabaseConfig() {
  return serverSupabaseConfigSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

/**
 * This is deliberately server-only. Supabase service-role clients bypass RLS,
 * so every operation using it must first call the authorization helpers below.
 */
export function createServiceSupabaseClient(): SupabaseClient {
  const config = getServerSupabaseConfig();
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAuthenticatedUserId(
  request: Request,
  client: SupabaseClient = createServiceSupabaseClient(),
): Promise<string> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    throw new AuthenticationError();
  }

  // getUser validates the token with Supabase Auth; decoding a JWT locally
  // would not establish that it is still valid.
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthenticationError();
  }

  return data.user.id;
}

export async function requireMatterAccess(
  client: SupabaseClient,
  userId: string,
  matterId: string,
): Promise<MatterAccess> {
  const { data: wallet, error: walletError } = await client
    .from("wallet_identities")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (walletError) {
    throw new ApiError(500, "DATABASE_ERROR", "Could not resolve the authenticated wallet.");
  }
  if (!wallet) {
    throw new AuthorizationError("Verify a wallet before accessing a matter.");
  }

  const { data: membership, error: membershipError } = await client
    .from("matter_members")
    .select("role")
    .eq("matter_id", matterId)
    .eq("wallet_identity_id", wallet.id)
    .maybeSingle();

  if (membershipError) {
    throw new ApiError(500, "DATABASE_ERROR", "Could not check matter membership.");
  }
  if (!membership) {
    throw new AuthorizationError();
  }

  return { walletIdentityId: wallet.id as string, role: membership.role as MatterAccess["role"] };
}
