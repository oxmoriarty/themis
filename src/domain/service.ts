import { z } from "zod";

import { hash256Schema, uuidSchema, walletAddressSchema } from "@/domain/identifiers";

export const serviceAvailabilityValues = ["ACTIVE", "PAUSED", "INACTIVE"] as const;
export const serviceAvailabilitySchema = z.enum(serviceAvailabilityValues);

export const serviceSourceValues = ["REAL", "SEED"] as const;
export const serviceSourceSchema = z.enum(serviceSourceValues);

export const legalServiceSchema = z.object({
  id: uuidSchema,
  onchainServiceId: z.string().min(1).max(128).nullable(),
  ownerWallet: walletAddressSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(4_000),
  services: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  specialties: z.array(z.string().trim().min(1).max(80)).max(16),
  jurisdictions: z.array(z.string().trim().min(1).max(80)).max(16),
  metadataUri: z.string().url().max(2_048).nullable(),
  metadataHash: hash256Schema.nullable(),
  availability: serviceAvailabilitySchema,
  source: serviceSourceSchema,
  completedMatterCount: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type LegalService = z.infer<typeof legalServiceSchema>;

