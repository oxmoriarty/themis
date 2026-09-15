import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import {
  createWalletChallenge,
  type WalletChallenge,
  type WalletChallengeRepository,
  verifyWalletChallenge,
} from "@/server/auth-challenge";

class InMemoryChallenges implements WalletChallengeRepository {
  public readonly challenges = new Map<string, WalletChallenge>();
  public wallet: { id: string; address: string } | null = null;

  public async createChallenge(challenge: Omit<WalletChallenge, "id" | "consumedAt">): Promise<WalletChallenge> {
    const created = { ...challenge, id: `00000000-0000-4000-8000-${String(this.challenges.size + 1).padStart(12, "0")}`, consumedAt: null };
    this.challenges.set(created.id, created);
    return created;
  }

  public async findChallenge(id: string): Promise<WalletChallenge | null> {
    return this.challenges.get(id) ?? null;
  }

  public async consumeChallenge(input: {
    challengeId: string;
    userId: string;
    walletAddress: string;
    signatureSha256: string;
  }): Promise<boolean> {
    const challenge = this.challenges.get(input.challengeId);
    if (!challenge || challenge.userId !== input.userId || challenge.walletAddress !== input.walletAddress || challenge.consumedAt) {
      return false;
    }
    challenge.consumedAt = new Date();
    return true;
  }

  public async findWalletForUser(): Promise<{ id: string; address: string } | null> {
    return this.wallet;
  }

  public async createWalletIdentity(input: { userId: string; walletAddress: string }): Promise<{ id: string; address: string }> {
    this.wallet = { id: "22222222-2222-4222-8222-222222222222", address: input.walletAddress };
    return this.wallet;
  }

  public async touchWalletIdentity(): Promise<void> {}
}

const userId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-09-15T12:00:00.000Z");
const account = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123");

describe("wallet challenge verification", () => {
  it("binds a Supabase user to a wallet only after a valid one-time signature", async () => {
    const repository = new InMemoryChallenges();
    const challenge = await createWalletChallenge(repository, {
      userId,
      walletAddress: account.address,
      domain: "https://themis.example",
      ttlSeconds: 300,
    }, now);
    const signature = await account.signMessage({ message: challenge.statement });

    const identity = await verifyWalletChallenge(repository, {
      userId,
      challengeId: challenge.id,
      signature,
    }, { now });

    expect(identity.address).toBe(account.address.toLowerCase());
    expect(challenge.statement).toContain("does not authorize a blockchain transaction");
    await expect(verifyWalletChallenge(repository, { userId, challengeId: challenge.id, signature }, { now })).rejects.toMatchObject({
      code: "INVALID_CHALLENGE",
    });
  });

  it("rejects expired challenges before accepting a signature", async () => {
    const repository = new InMemoryChallenges();
    const challenge = await createWalletChallenge(repository, {
      userId,
      walletAddress: account.address,
      domain: "https://themis.example",
      ttlSeconds: 60,
    }, now);
    const signature = await account.signMessage({ message: challenge.statement });

    await expect(verifyWalletChallenge(repository, {
      userId,
      challengeId: challenge.id,
      signature,
    }, { now: new Date(now.getTime() + 60_000) })).rejects.toMatchObject({ code: "INVALID_CHALLENGE" });
  });

  it("rejects a signature from a different wallet", async () => {
    const repository = new InMemoryChallenges();
    const challenge = await createWalletChallenge(repository, {
      userId,
      walletAddress: account.address,
      domain: "https://themis.example",
      ttlSeconds: 300,
    }, now);
    const other = privateKeyToAccount("0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    const signature = await other.signMessage({ message: challenge.statement });

    await expect(verifyWalletChallenge(repository, { userId, challengeId: challenge.id, signature }, { now })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
