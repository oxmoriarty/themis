import { z } from "zod";

import {
  a2aAgentCardSchema,
  a2aGetTaskParamsSchema,
  a2aListTasksParamsSchema,
  a2aSendMessageParamsSchema,
  a2aTaskSchema,
  type A2aAgentCard,
  type A2aTask,
} from "@/domain/a2a";
import { publicServiceEndpointUrlSchema } from "@/domain/service";

type FetchRequestInit = NonNullable<Parameters<typeof fetch>[1]>;

const jsonRpcIdSchema = z.union([z.string().min(1).max(160), z.number().finite()]);
const jsonRpcEnvelopeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([jsonRpcIdSchema, z.null()]),
  result: z.unknown().optional(),
  error: z.object({ code: z.number().int(), message: z.string().min(1), data: z.unknown().optional() }).optional(),
}).strict();

export class A2aClientError extends Error {
  public constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message);
    this.name = "A2aClientError";
  }
}

export type A2aClientOptions = {
  fetch?: typeof fetch;
};

/**
 * Transport for a caller-selected, externally hosted A2A v1 JSON-RPC agent.
 * Credentials are opt-in per call; it never inherits a Themis API token.
 */
export class A2aClient {
  private readonly fetchImplementation: typeof fetch;

  public constructor(options: A2aClientOptions = {}) {
    this.fetchImplementation = options.fetch ?? fetch;
  }

  public async discover(agentCardUrl: string): Promise<A2aAgentCard> {
    const url = publicServiceEndpointUrlSchema.parse(agentCardUrl);
    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        method: "GET", headers: { accept: "application/json" }, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
      });
    } catch {
      throw new A2aClientError("AGENT_CARD_UNREACHABLE", "The A2A Agent Card could not be reached.");
    }
    if (!response.ok) throw new A2aClientError("AGENT_CARD_HTTP_ERROR", `The A2A Agent Card returned HTTP ${response.status}.`, response.status);
    const card = a2aAgentCardSchema.safeParse(await response.json().catch(() => null));
    if (!card.success) throw new A2aClientError("INVALID_AGENT_CARD", "The published A2A Agent Card is invalid.", response.status);
    return card.data;
  }

  public async sendMessage(card: A2aAgentCard, params: z.input<typeof a2aSendMessageParamsSchema>, options: { accessToken?: string } = {}): Promise<A2aTask> {
    const validated = a2aSendMessageParamsSchema.parse(params);
    const result = await this.call(card, "SendMessage", validated, options.accessToken);
    const response = z.object({ task: a2aTaskSchema }).strict().safeParse(result);
    if (!response.success) throw new A2aClientError("INVALID_A2A_RESPONSE", "The A2A agent returned an invalid SendMessage response.");
    return response.data.task;
  }

  public async getTask(card: A2aAgentCard, params: z.input<typeof a2aGetTaskParamsSchema>, options: { accessToken?: string } = {}): Promise<A2aTask> {
    return a2aTaskSchema.parse(await this.call(card, "GetTask", a2aGetTaskParamsSchema.parse(params), options.accessToken));
  }

  public async listTasks(card: A2aAgentCard, params: z.input<typeof a2aListTasksParamsSchema> = {}, options: { accessToken?: string } = {}) {
    const result = await this.call(card, "ListTasks", a2aListTasksParamsSchema.parse(params), options.accessToken);
    const parsed = z.object({ tasks: z.array(a2aTaskSchema), nextPageToken: z.string() }).strict().safeParse(result);
    if (!parsed.success) throw new A2aClientError("INVALID_A2A_RESPONSE", "The A2A agent returned an invalid ListTasks response.");
    return parsed.data;
  }

  public async cancelTask(card: A2aAgentCard, taskId: string, options: { accessToken?: string } = {}): Promise<A2aTask> {
    return a2aTaskSchema.parse(await this.call(card, "CancelTask", { id: z.string().uuid().parse(taskId) }, options.accessToken));
  }

  private async call(card: A2aAgentCard, method: string, params: unknown, accessToken?: string): Promise<unknown> {
    const validatedCard = a2aAgentCardSchema.parse(card);
    const endpoint = validatedCard.supportedInterfaces.find((item) => item.protocolBinding === "JSONRPC" && item.protocolVersion === "1.0");
    if (!endpoint) throw new A2aClientError("A2A_INTERFACE_UNAVAILABLE", "The A2A Agent Card does not publish a JSON-RPC 1.0 interface.");
    const id = crypto.randomUUID();
    const headers = new Headers({ accept: "application/json", "content-type": "application/json", "A2A-Version": "1.0" });
    if (accessToken) headers.set("authorization", `Bearer ${z.string().min(1).parse(accessToken)}`);
    let response: Response;
    try {
      response = await this.fetchImplementation(endpoint.url, {
        method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
      } satisfies FetchRequestInit);
    } catch {
      throw new A2aClientError("A2A_ENDPOINT_UNREACHABLE", "The A2A agent endpoint could not be reached.");
    }
    const envelope = jsonRpcEnvelopeSchema.safeParse(await response.json().catch(() => null));
    if (!envelope.success || envelope.data.id !== id) throw new A2aClientError("INVALID_A2A_RESPONSE", "The A2A agent returned an invalid JSON-RPC response.", response.status);
    if (envelope.data.error) throw new A2aClientError(`A2A_${envelope.data.error.code}`, envelope.data.error.message, response.status);
    if (!response.ok) throw new A2aClientError("A2A_HTTP_ERROR", `The A2A agent returned HTTP ${response.status}.`, response.status);
    return envelope.data.result;
  }
}
