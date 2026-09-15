import { createHash, randomBytes } from "node:crypto";

import { verifyMessage } from "viem";
import { z } from "zod";

import { uuidSchema, walletAddressSchema } from "@/domain/identifiers";
import { ApiError, AuthorizationError } from "@/server/errors";

const signatureSchema = z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Invalid wallet signature.");

export const createWalletChallengeInputSchema = z.object({
  userId: uuidSchema,
  walletAddress: walletAddressSchema,
  domain: z.string().url().max(2_048),
  ttlSeconds: z.number().int().min(60).max(900),
});

export const verifyWalletChallengeInputSchema = z.object({
  userId: uuidSchema,
  challengeId: uuidSchema,
  signature: signatureSchema,
});

export type WalletChallenge = {
  id: string;
  userId: string;
  walletAddress: string;
  nonce: string;
  domain: string;
  statement: string;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
};

export interface WalletChallengeRepository {
  createChallenge(challenge: Omit<WalletChallenge, "id" | "consumedAt">): Promise<WalletChallenge>;
  findChallenge(id: string): Promise<WalletChallenge | null>;
  consumeChallenge(input: {
    challengeId: string;
    userId: string;
    walletAddress: string;
    signatureSha256: string;
  }): Promise<boolean>;
  findWalletForUser(userId: string): Promise<{ id: string; address: string } | null>;
  createWalletIdentity(input: { userId: string; walletAddress: string }): Promise<{ id: string; address: string }>;
  touchWalletIdentity(id: string): Promise<void>;
}

export function makeWalletChallengeStatement(input: {
  walletAddress: string;
  nonce: string;
  domain: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return [
    "Themis wallet verification",
    "Sign this message only to prove control of this address for the Themis API.",
    "It does not authorize a blockchain transaction, payment, or wallet custody.",
    `URI: ${input.domain}`,
    `Address: ${input.walletAddress}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expiresAt.toISOString()}`,
  ].join("\n");
}

export async function createWalletChallenge(
  repository: WalletChallengeRepository,
  rawInput: z.input<typeof createWalletChallengeInputSchema>,
  now = new Date(),
): Promise<WalletChallenge> {
  const input = createWalletChallengeInputSchema.parse(rawInput);
  const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1_000);
  const nonce = randomBytes(32).toString("base64url");
  const statement = makeWalletChallengeStatement({
    walletAddress: input.walletAddress,
    nonce,
    domain: input.domain,
    issuedAt: now,
    expiresAt,
  });

  return repository.createChallenge({
    userId: input.userId,
    walletAddress: input.walletAddress,
    nonce,
    domain: input.domain,
    statement,
    issuedAt: now,
    expiresAt,
  });
}

export async function verifyWalletChallenge(
  repository: WalletChallengeRepository,
  rawInput: z.input<typeof verifyWalletChallengeInputSchema>,
  options: {
    now?: Date;
    verify?: typeof verifyMessage;
  } = {},
): Promise<{ id: string; address: string }> {
  const input = verifyWalletChallengeInputSchema.parse(rawInput);
  const now = options.now ?? new Date();
  const challenge = await repository.findChallenge(input.challengeId);

  if (
    !challenge ||
    challenge.userId !== input.userId ||
    challenge.consumedAt !== null ||
    challenge.expiresAt.getTime() <= now.getTime()
  ) {
    throw new ApiError(400, "INVALID_CHALLENGE", "The wallet challenge is expired, consumed, or unavailable.");
  }

  const isValidSignature = await (options.verify ?? verifyMessage)({
    address: challenge.walletAddress as `0x${string}`,
    message: challenge.statement,
    signature: input.signature as `0x${string}`,
  });
  if (!isValidSignature) {
    throw new AuthorizationError("The signature does not prove control of the challenged wallet.");
  }

  const consumed = await repository.consumeChallenge({
    challengeId: challenge.id,
    userId: input.userId,
    walletAddress: challenge.walletAddress,
    signatureSha256: createHash("sha256").update(input.signature).digest("hex"),
  });
  if (!consumed) {
    throw new ApiError(409, "CHALLENGE_ALREADY_USED", "The wallet challenge was already consumed.");
  }

  const existingWallet = await repository.findWalletForUser(input.userId);
  if (existingWallet) {
    if (existingWallet.address !== challenge.walletAddress) {
      throw new AuthorizationError("This user is already bound to a different verified wallet.");
    }
    await repository.touchWalletIdentity(existingWallet.id);
    return existingWallet;
  }

  return repository.createWalletIdentity({
    userId: input.userId,
    walletAddress: challenge.walletAddress,
  });
}
