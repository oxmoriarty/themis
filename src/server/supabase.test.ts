import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { requireMatterAccess } from "@/server/supabase";

function accessClient(options: {
  wallet: { id: string } | null;
  membership: { role: "CLIENT" | "PROVIDER" } | null;
  walletError?: boolean;
  membershipError?: boolean;
}): SupabaseClient {
  return {
    from(table: string) {
      const result = table === "wallet_identities"
        ? { data: options.wallet, error: options.walletError ? new Error("wallet failure") : null }
        : { data: options.membership, error: options.membershipError ? new Error("membership failure") : null };
      const chain = {
        eq: () => chain,
        maybeSingle: async () => result,
      };
      return { select: () => chain };
    },
  } as unknown as SupabaseClient;
}

describe("server-side matter authorization", () => {
  it("allows a verified member and returns its server-derived role", async () => {
    await expect(requireMatterAccess(
      accessClient({ wallet: { id: "wallet-1" }, membership: { role: "CLIENT" } }),
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    )).resolves.toEqual({ walletIdentityId: "wallet-1", role: "CLIENT" });
  });

  it("rejects an authenticated user with no verified wallet", async () => {
    await expect(requireMatterAccess(
      accessClient({ wallet: null, membership: null }),
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    )).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a verified wallet that is not a member", async () => {
    await expect(requireMatterAccess(
      accessClient({ wallet: { id: "wallet-1" }, membership: null }),
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    )).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
