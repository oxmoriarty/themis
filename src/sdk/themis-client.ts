import { z } from "zod";

import {
  createMatterRequestSchema,
  createMatterResponseSchema,
  matterStatusResponseSchema,
  serviceProfileResponseSchema,
  serviceSearchQuerySchema,
  serviceSearchResponseSchema,
  type CreateMatterRequest,
  type MatterStatus,
  type ServiceSearchQuery,
} from "@/api/contracts";

const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

const clientOptionsSchema = z.object({
  baseUrl: z.string().url(),
  accessToken: z.string().min(1).optional(),
  fetch: z.custom<typeof fetch>((value) => typeof value === "function").optional(),
});

export class ThemisApiError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ThemisApiError";
  }
}

export type ThemisClientOptions = z.input<typeof clientOptionsSchema>;

/**
 * Small, transport-only SDK for the implemented REST API. It has no wallet
 * provider, private-key, transaction-submission, A2A, or custody behavior.
 */
export class ThemisClient {
  private accessToken: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;

  public readonly services = {
    search: async (query: ServiceSearchQuery = {}) => {
      const validated = serviceSearchQuerySchema.parse(query);
      const search = new URLSearchParams();
      if (validated.query) search.set("query", validated.query);
      if (validated.service) search.set("service", validated.service);
      if (validated.jurisdiction) search.set("jurisdiction", validated.jurisdiction);
      if (validated.limit !== 20) search.set("limit", String(validated.limit));

      const suffix = search.size > 0 ? `?${search.toString()}` : "";
      return (await this.request(`/services${suffix}`, { method: "GET" }, serviceSearchResponseSchema)).services;
    },
    get: async (serviceId: string) => {
      const id = z.string().uuid().parse(serviceId);
      return (await this.request(`/services/${encodeURIComponent(id)}`, { method: "GET" }, serviceProfileResponseSchema)).service;
    },
  };

  public readonly matters = {
    create: async (input: CreateMatterRequest) => {
      const body = createMatterRequestSchema.parse(input);
      this.requireAuthentication();
      return this.request(
        "/matters",
        { method: "POST", body: JSON.stringify(body) },
        createMatterResponseSchema,
        true,
      ).then((response) => response.matter);
    },
    get: async (matterId: string): Promise<MatterStatus> => {
      const id = z.string().uuid().parse(matterId);
      this.requireAuthentication();
      return this.request(
        `/matters/${encodeURIComponent(id)}`,
        { method: "GET" },
        matterStatusResponseSchema,
        true,
      ).then((response) => response.matter);
    },
  };

  public constructor(options: ThemisClientOptions) {
    const parsed = clientOptionsSchema.parse(options);
    this.baseUrl = parsed.baseUrl.replace(/\/$/, "");
    this.accessToken = parsed.accessToken;
    this.fetchImplementation = parsed.fetch ?? fetch;
  }

  /** Allows a program to rotate its short-lived Supabase Auth access token. */
  public setAccessToken(accessToken: string | undefined): void {
    this.accessToken = accessToken ? z.string().min(1).parse(accessToken) : undefined;
  }

  private requireAuthentication(): void {
    if (!this.accessToken) {
      throw new ThemisApiError(
        "AUTHENTICATION_REQUIRED",
        "Set a valid Supabase Auth access token before calling a private Themis API operation.",
      );
    }
  }

  private async request<T extends z.ZodTypeAny>(
    path: string,
    init: RequestInit,
    schema: T,
    authenticated = false,
  ): Promise<z.output<T>> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    if (authenticated && this.accessToken) headers.set("authorization", `Bearer ${this.accessToken}`);

    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new ThemisApiError("NETWORK_ERROR", "The Themis API could not be reached.");
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = apiErrorBodySchema.safeParse(body);
      if (parsedError.success) {
        throw new ThemisApiError(parsedError.data.error.code, parsedError.data.error.message, response.status);
      }
      throw new ThemisApiError("HTTP_ERROR", `The Themis API returned HTTP ${response.status}.`, response.status);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ThemisApiError("INVALID_RESPONSE", "The Themis API returned an unexpected response.", response.status);
    }
    return parsed.data;
  }
}
