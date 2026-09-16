import { z } from "zod";

import { hash256Schema, uuidSchema, walletAddressSchema } from "@/domain/identifiers";

export const serviceAvailabilityValues = ["ACTIVE", "PAUSED", "INACTIVE"] as const;
export const serviceAvailabilitySchema = z.enum(serviceAvailabilityValues);

export const serviceSourceValues = ["REAL", "SEED"] as const;
export const serviceSourceSchema = z.enum(serviceSourceValues);

export const serviceEndpointProtocol = "themis-service-endpoint-v1" as const;
export const serviceEndpointCapabilityValues = ["INQUIRY", "MATTER_INTAKE", "SERVICE_MESSAGE"] as const;
export const serviceEndpointCapabilitySchema = z.enum(serviceEndpointCapabilityValues);
export type ServiceEndpointCapability = z.infer<typeof serviceEndpointCapabilitySchema>;

function isPrivateIpv4Host(hostname: string): boolean {
  const pieces = hostname.split(".").map(Number);
  if (pieces.length !== 4 || pieces.some((piece) => !Number.isInteger(piece) || piece < 0 || piece > 255)) return false;
  return pieces[0] === 10
    || pieces[0] === 127
    || (pieces[0] === 169 && pieces[1] === 254)
    || (pieces[0] === 172 && pieces[1] >= 16 && pieces[1] <= 31)
    || (pieces[0] === 192 && pieces[1] === 168)
    || pieces[0] === 0;
}

function isPrivateIpv6Host(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "::" || normalized === "::1"
    || normalized.startsWith("fc") || normalized.startsWith("fd")
    || normalized.startsWith("fe80:")
    || normalized.startsWith("::ffff:127.")
    || normalized.startsWith("::ffff:10.")
    || normalized.startsWith("::ffff:192.168.")
    || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(normalized);
}

/**
 * A published, caller-owned contact endpoint. Themis never fetches this URL
 * from its server and never forwards authentication credentials to it.
 */
export const publicServiceEndpointUrlSchema = z.string().trim().max(2_048).url().superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Agent endpoints must be credential-free HTTPS URLs." });
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isPrivateIpv4Host(hostname) || isPrivateIpv6Host(hostname)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Agent endpoints must not target local or private network hosts." });
  }
});

export const serviceEndpointDescriptorSchema = z.object({
  protocol: z.literal(serviceEndpointProtocol),
  url: publicServiceEndpointUrlSchema,
  capabilities: z.array(serviceEndpointCapabilitySchema).min(1).max(serviceEndpointCapabilityValues.length)
    .refine((values) => new Set(values).size === values.length, "Endpoint capabilities must not repeat."),
}).strict();

export type ServiceEndpointDescriptor = z.infer<typeof serviceEndpointDescriptorSchema>;

/**
 * An externally hosted A2A Agent Card. Themis stores this pointer only: it
 * does not fetch it from the server, proxy A2A calls, or forward credentials.
 */
export const serviceA2aDescriptorSchema = z.object({
  agentCardUrl: publicServiceEndpointUrlSchema,
}).strict();

export type ServiceA2aDescriptor = z.infer<typeof serviceA2aDescriptorSchema>;

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
  integration: serviceEndpointDescriptorSchema.nullable(),
  a2a: serviceA2aDescriptorSchema.nullable(),
  availability: serviceAvailabilitySchema,
  source: serviceSourceSchema,
  completedMatterCount: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type LegalService = z.infer<typeof legalServiceSchema>;
