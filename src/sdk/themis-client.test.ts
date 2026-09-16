import { describe, expect, it, vi } from "vitest";

import { ThemisApiError, ThemisClient } from "@/sdk/themis-client";
import { registerServiceRequestSchema } from "@/api/contracts";
import type { LegalService } from "@/domain/service";

const serviceId = "11111111-1111-4111-8111-111111111111";
const matterId = "22222222-2222-4222-8222-222222222222";
const providerWallet = "0x1111111111111111111111111111111111111111";
const clientWallet = "0x2222222222222222222222222222222222222222";

const service = {
  id: serviceId,
  onchainServiceId: null,
  ownerWallet: providerWallet,
  name: "Contract review agent",
  description: "Prototype written-obligation review.",
  services: ["Contract review"],
  specialties: ["Commercial"],
  jurisdictions: ["Nigeria"],
  metadataUri: null,
  metadataHash: null,
  integration: null,
  a2a: null,
  availability: "ACTIVE",
  source: "REAL",
  completedMatterCount: 0,
  createdAt: "2026-09-15T00:00:00.000Z",
  updatedAt: "2026-09-15T00:00:00.000Z",
};

const matter = {
  id: matterId,
  onchainMatterId: null,
  contractAddress: null,
  title: "Invoice acceptance",
  privateDescription: "The parties disagree about the accepted invoice.",
  serviceId,
  state: "DRAFT",
  clientWallet,
  providerWallet,
  agreementOriginalSha256: null,
  consensusTemplateVersion: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  updatedAt: "2026-09-15T00:00:00.000Z",
  viewerRole: "CLIENT",
  chainTransactions: [],
};

describe("ThemisClient", () => {
  it("discovers public services with validated query parameters", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ services: [service] })));
    const client = new ThemisClient({ baseUrl: "https://themis.example/api/v1", fetch: fetchImplementation });

    const result = await client.services.search({ query: "Contract", jurisdiction: "Nigeria", limit: 10 });

    expect(result[0]?.name).toBe("Contract review agent");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://themis.example/api/v1/services?query=Contract&jurisdiction=Nigeria&limit=10",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("creates and reads a matter using a caller-supplied bearer token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ matter }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ matter })));
    const client = new ThemisClient({
      baseUrl: "https://themis.example/api/v1",
      accessToken: "supabase-access-token",
      fetch: fetchImplementation,
    });

    await client.matters.create({
      title: matter.title,
      privateDescription: matter.privateDescription,
      providerWalletAddress: providerWallet,
      serviceId,
    });
    const status = await client.matters.get(matterId);

    expect(status.state).toBe("DRAFT");
    const createRequest = fetchImplementation.mock.calls[0]?.[1] as NonNullable<Parameters<typeof fetch>[1]>;
    expect(new Headers(createRequest.headers).get("authorization")).toBe("Bearer supabase-access-token");
    expect(createRequest.body).toContain("Invoice acceptance");
  });

  it("registers a developer profile with its validated direct-contact descriptor", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ service }), { status: 201 }));
    const client = new ThemisClient({
      baseUrl: "https://themis.example/api/v1",
      accessToken: "supabase-access-token",
      fetch: fetchImplementation,
    });

    const registered = await client.services.register({
      name: service.name,
      description: service.description,
      services: service.services,
      specialties: service.specialties,
      jurisdictions: service.jurisdictions,
      metadataUri: null,
      integration: {
        protocol: "themis-service-endpoint-v1",
        url: "https://review.example.com/themis/contact",
        capabilities: ["INQUIRY", "MATTER_INTAKE"],
      },
    });

    expect(registered.id).toBe(serviceId);
    const request = fetchImplementation.mock.calls[0]?.[1] as NonNullable<Parameters<typeof fetch>[1]>;
    expect(request.method).toBe("POST");
    expect(new Headers(request.headers).get("authorization")).toBe("Bearer supabase-access-token");
    expect(request.body).toContain("themis-service-endpoint-v1");
  });

  it("rejects unsafe published contact URLs before a profile reaches the server", () => {
    expect(registerServiceRequestSchema.safeParse({
      name: service.name,
      description: service.description,
      services: service.services,
      integration: { protocol: "themis-service-endpoint-v1", url: "http://localhost:8080/contact", capabilities: ["INQUIRY"] },
    }).success).toBe(false);
    expect(registerServiceRequestSchema.safeParse({
      name: service.name,
      description: service.description,
      services: service.services,
      a2a: { agentCardUrl: "https://[::1]/.well-known/agent-card.json" },
    }).success).toBe(false);
  });

  it("contacts only a declared provider operation without forwarding Themis credentials", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      protocol: "themis-service-endpoint-v1",
      requestId: matterId,
      received: true,
      reference: "provider-request-7",
    })));
    const client = new ThemisClient({
      baseUrl: "https://themis.example/api/v1",
      accessToken: "must-not-leave-themis",
      fetch: fetchImplementation,
    });
    const contactableService = {
      ...service,
      integration: {
        protocol: "themis-service-endpoint-v1",
        url: "https://review.example.com/themis/contact",
        capabilities: ["INQUIRY"],
      },
    } as unknown as LegalService;

    const response = await client.services.contact(contactableService, {
      requestId: matterId,
      operation: "INQUIRY",
      message: "Can you review a written obligation?",
    });

    expect(response.received).toBe(true);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://review.example.com/themis/contact",
      expect.objectContaining({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" }),
    );
    const contactRequest = fetchImplementation.mock.calls[0]?.[1] as NonNullable<Parameters<typeof fetch>[1]>;
    expect(new Headers(contactRequest.headers).get("authorization")).toBeNull();
    expect(contactRequest.body).toContain("Can you review a written obligation?");
  });

  it("does not send a request for an undeclared provider operation", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const client = new ThemisClient({ baseUrl: "https://themis.example/api/v1", fetch: fetchImplementation });
    const contactableService = {
      ...service,
      integration: { protocol: "themis-service-endpoint-v1", url: "https://review.example.com/themis/contact", capabilities: ["INQUIRY"] },
    } as unknown as LegalService;

    await expect(client.services.contact(contactableService, {
      requestId: matterId,
      operation: "SERVICE_MESSAGE",
      message: "This must not be sent.",
    })).rejects.toMatchObject({ code: "SERVICE_OPERATION_UNSUPPORTED" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("fails before making a private request without an access token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const client = new ThemisClient({ baseUrl: "https://themis.example/api/v1", fetch: fetchImplementation });

    await expect(client.matters.get(matterId)).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("returns typed API errors rather than treating a failed request as success", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "SERVICE_NOT_FOUND", message: "The legal service agent was not found." },
    }), { status: 404 }));
    const client = new ThemisClient({ baseUrl: "https://themis.example/api/v1", fetch: fetchImplementation });

    await expect(client.services.get(serviceId)).rejects.toEqual(expect.objectContaining<Partial<ThemisApiError>>({
      code: "SERVICE_NOT_FOUND",
      status: 404,
    }));
  });
});
