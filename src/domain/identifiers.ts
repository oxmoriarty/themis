import { z } from "zod";

export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet address must be a 20-byte hexadecimal address.")
  .transform((value) => value.toLowerCase());

export const hash256Schema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, "Hash must be a 64-character SHA-256 hexadecimal digest.")
  .transform((value) => value.toLowerCase());

export const uuidSchema = z.string().uuid();

export const transactionHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Transaction hash must be a 32-byte hexadecimal hash.")
  .transform((value) => value.toLowerCase());

export type WalletAddress = z.infer<typeof walletAddressSchema>;
export type Hash256 = z.infer<typeof hash256Schema>;
export type TransactionHash = z.infer<typeof transactionHashSchema>;

