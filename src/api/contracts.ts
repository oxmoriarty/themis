import { z } from "zod";

import { executionResultSchema, genLayerTransactionStatusSchema } from "@/domain/chain";
import { uuidSchema, walletAddressSchema } from "@/domain/identifiers";
import { matterStateSchema } from "@/domain/lifecycle";
import { legalServiceSchema } from "@/domain/service";

export const serviceSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(120).optional(),
  service: z.string().trim().min(1).max(80).optional(),
  jurisdiction: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export type ServiceSearchQuery = z.input<typeof serviceSearchQuerySchema>;

export const serviceSearchResponseSchema = z.object({
  services: z.array(legalServiceSchema),
});

export const serviceProfileResponseSchema = z.object({
  service: legalServiceSchema,
});

export const createMatterRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  privateDescription: z.string().trim().min(1).max(8_000),
  providerWalletAddress: walletAddressSchema,
  serviceId: uuidSchema,
}).strict();

export type CreateMatterRequest = z.input<typeof createMatterRequestSchema>;

export const matterTransactionStatusSchema = z.object({
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).transform((value) => value.toLowerCase()),
  action: z.string().min(1).max(64),
  status: genLayerTransactionStatusSchema,
  executionResult: executionResultSchema.nullable(),
  observedAt: z.coerce.date(),
});

export const matterStatusSchema = z.object({
  id: uuidSchema,
  onchainMatterId: z.string().min(1).max(128).nullable(),
  contractAddress: walletAddressSchema.nullable(),
  title: z.string().min(1).max(160),
  privateDescription: z.string().min(1).max(8_000),
  serviceId: uuidSchema,
  state: matterStateSchema,
  clientWallet: walletAddressSchema,
  providerWallet: walletAddressSchema,
  agreementOriginalSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).transform((value) => value.toLowerCase()).nullable(),
  consensusTemplateVersion: z.string().max(64).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  viewerRole: z.enum(["CLIENT", "PROVIDER"]),
  chainTransactions: z.array(matterTransactionStatusSchema),
});

export const createMatterResponseSchema = z.object({ matter: matterStatusSchema });
export const matterStatusResponseSchema = z.object({ matter: matterStatusSchema });

export type ServiceSearchResponse = z.infer<typeof serviceSearchResponseSchema>;
export type ServiceProfileResponse = z.infer<typeof serviceProfileResponseSchema>;
export type MatterStatus = z.infer<typeof matterStatusSchema>;
