import { z } from "zod";

import { publicServiceEndpointUrlSchema } from "@/domain/service";

export const a2aProtocolVersion = "1.0" as const;
export const a2aTaskStateValues = [
  "TASK_STATE_SUBMITTED", "TASK_STATE_WORKING", "TASK_STATE_COMPLETED", "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED", "TASK_STATE_REJECTED", "TASK_STATE_INPUT_REQUIRED", "TASK_STATE_AUTH_REQUIRED",
] as const;
export const a2aTaskStateSchema = z.enum(a2aTaskStateValues);
export type A2aTaskState = z.infer<typeof a2aTaskStateSchema>;

const a2aInterfaceUrlSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value);
  const localHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !localHttp) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A2A interfaces require HTTPS outside local development." });
  }
});

const a2aPartSchema = z.object({
  text: z.string().max(12_000).optional(),
  data: z.unknown().optional(),
}).strict().refine((part) => (part.text !== undefined) !== (part.data !== undefined), "A part must contain exactly one supported content type.");

export const a2aMessageSchema = z.object({
  role: z.enum(["ROLE_USER", "ROLE_AGENT"]),
  messageId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  contextId: z.string().uuid().optional(),
  parts: z.array(a2aPartSchema).min(1).max(8),
}).strict();

export const a2aTaskSchema = z.object({
  id: z.string().uuid(),
  contextId: z.string().uuid().optional(),
  status: z.object({
    state: a2aTaskStateSchema,
    timestamp: z.string().datetime(),
    message: a2aMessageSchema.optional(),
  }).strict(),
  artifacts: z.array(z.object({
    artifactId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    parts: z.array(a2aPartSchema).min(1).max(8),
  }).strict()).optional(),
  history: z.array(a2aMessageSchema).optional(),
}).strict();
export type A2aTask = z.infer<typeof a2aTaskSchema>;

export const a2aAgentCardSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(4_000),
  version: z.string().min(1).max(64),
  documentationUrl: publicServiceEndpointUrlSchema.optional(),
  supportedInterfaces: z.array(z.object({
    url: a2aInterfaceUrlSchema,
    protocolBinding: z.literal("JSONRPC"),
    protocolVersion: z.literal(a2aProtocolVersion),
  }).strict()).min(1),
  capabilities: z.object({
    streaming: z.boolean(),
    pushNotifications: z.boolean(),
    extendedAgentCard: z.boolean(),
  }).strict(),
  securitySchemes: z.record(z.object({
    httpAuthSecurityScheme: z.object({
      scheme: z.literal("Bearer"),
      bearerFormat: z.string().min(1).max(80).optional(),
      description: z.string().min(1).max(500).optional(),
    }).strict(),
  }).strict()).optional(),
  securityRequirements: z.array(z.object({
    schemes: z.record(z.object({ list: z.array(z.string()).max(8) }).strict()),
  }).strict()).optional(),
  defaultInputModes: z.array(z.string()).min(1),
  defaultOutputModes: z.array(z.string()).min(1),
  skills: z.array(z.object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(2_000),
    tags: z.array(z.string().min(1).max(80)).max(12),
    inputModes: z.array(z.string()).min(1),
    outputModes: z.array(z.string()).min(1),
  }).strict()).min(1),
}).strict();
export type A2aAgentCard = z.infer<typeof a2aAgentCardSchema>;

export const a2aSendMessageParamsSchema = z.object({
  message: a2aMessageSchema,
  configuration: z.object({
    acceptedOutputModes: z.array(z.string().min(1).max(120)).max(8).optional(),
    historyLength: z.number().int().min(0).max(100).optional(),
    returnImmediately: z.boolean().optional(),
  }).strict().optional(),
}).strict();

export const a2aGetTaskParamsSchema = z.object({
  id: z.string().uuid(),
  historyLength: z.number().int().min(0).max(100).optional(),
}).strict();

export const a2aListTasksParamsSchema = z.object({
  contextId: z.string().uuid().optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
  pageToken: z.string().max(512).optional(),
  includeArtifacts: z.boolean().optional(),
}).strict();
