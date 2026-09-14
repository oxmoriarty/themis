import { z } from "zod";

import { hash256Schema, uuidSchema, walletAddressSchema } from "@/domain/identifiers";
import { matterStateSchema } from "@/domain/lifecycle";

export const participantRoleValues = ["CLIENT", "PROVIDER"] as const;
export const participantRoleSchema = z.enum(participantRoleValues);

export const matterSchema = z.object({
  id: uuidSchema,
  onchainMatterId: z.string().min(1).max(128).nullable(),
  contractAddress: z.string().nullable(),
  title: z.string().trim().min(1).max(160),
  privateDescription: z.string().trim().min(1).max(8_000),
  clientWallet: walletAddressSchema,
  providerWallet: walletAddressSchema,
  serviceId: uuidSchema,
  state: matterStateSchema,
  agreementOriginalSha256: hash256Schema.nullable(),
  consensusTemplateVersion: z.string().max(64).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Matter = z.infer<typeof matterSchema>;

export const matterMemberSchema = z.object({
  matterId: uuidSchema,
  wallet: walletAddressSchema,
  role: participantRoleSchema,
  joinedAt: z.coerce.date(),
});

export type MatterMember = z.infer<typeof matterMemberSchema>;

