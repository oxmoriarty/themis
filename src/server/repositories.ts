import type { SupabaseClient } from "@supabase/supabase-js";

import type { WalletChallenge, WalletChallengeRepository } from "@/server/auth-challenge";
import { ApiError, AuthorizationError } from "@/server/errors";

type ChallengeRow = {
  id: string;
  auth_user_id: string;
  wallet_address: string;
  nonce: string;
  domain: string;
  statement: string;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
};

function databaseError(message: string): ApiError {
  return new ApiError(500, "DATABASE_ERROR", message);
}

function mapChallenge(row: ChallengeRow): WalletChallenge {
  return {
    id: row.id,
    userId: row.auth_user_id,
    walletAddress: row.wallet_address,
    nonce: row.nonce,
    domain: row.domain,
    statement: row.statement,
    issuedAt: new Date(row.issued_at),
    expiresAt: new Date(row.expires_at),
    consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
  };
}

export class SupabaseWalletChallengeRepository implements WalletChallengeRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async createChallenge(challenge: Omit<WalletChallenge, "id" | "consumedAt">): Promise<WalletChallenge> {
    const { data, error } = await this.client
      .from("auth_challenges")
      .insert({
        auth_user_id: challenge.userId,
        wallet_address: challenge.walletAddress,
        nonce: challenge.nonce,
        domain: challenge.domain,
        statement: challenge.statement,
        issued_at: challenge.issuedAt.toISOString(),
        expires_at: challenge.expiresAt.toISOString(),
      })
      .select("id, auth_user_id, wallet_address, nonce, domain, statement, issued_at, expires_at, consumed_at")
      .single();

    if (error || !data) throw databaseError("Could not create the wallet challenge.");
    return mapChallenge(data as ChallengeRow);
  }

  public async findChallenge(id: string): Promise<WalletChallenge | null> {
    const { data, error } = await this.client
      .from("auth_challenges")
      .select("id, auth_user_id, wallet_address, nonce, domain, statement, issued_at, expires_at, consumed_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw databaseError("Could not read the wallet challenge.");
    return data ? mapChallenge(data as ChallengeRow) : null;
  }

  public async consumeChallenge(input: {
    challengeId: string;
    userId: string;
    walletAddress: string;
    signatureSha256: string;
  }): Promise<boolean> {
    const { error } = await this.client.rpc("consume_wallet_challenge", {
      p_challenge_id: input.challengeId,
      p_auth_user_id: input.userId,
      p_wallet_address: input.walletAddress,
      p_signature_sha256: input.signatureSha256,
    });

    if (!error) return true;
    if (error.code === "P0001") return false;
    throw databaseError("Could not consume the wallet challenge.");
  }

  public async findWalletForUser(userId: string): Promise<{ id: string; address: string } | null> {
    const { data, error } = await this.client
      .from("wallet_identities")
      .select("id, address")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw databaseError("Could not resolve the verified wallet.");
    return data ? (data as { id: string; address: string }) : null;
  }

  public async createWalletIdentity(input: {
    userId: string;
    walletAddress: string;
  }): Promise<{ id: string; address: string }> {
    const { data, error } = await this.client
      .from("wallet_identities")
      .insert({ user_id: input.userId, address: input.walletAddress })
      .select("id, address")
      .single();

    if (error?.code === "23505") {
      throw new AuthorizationError("That wallet is already bound to another user.");
    }
    if (error || !data) throw databaseError("Could not store the verified wallet.");
    return data as { id: string; address: string };
  }

  public async touchWalletIdentity(id: string): Promise<void> {
    const { error } = await this.client
      .from("wallet_identities")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw databaseError("Could not update the verified wallet.");
  }
}
