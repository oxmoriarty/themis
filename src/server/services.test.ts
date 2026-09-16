import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { discoverServices, getPublicService } from "@/server/services";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  onchain_service_id: null,
  owner_wallet: { address: "0x1111111111111111111111111111111111111111" },
  name: "Contract review agent",
  description: "Prototype written-obligation review.",
  services: ["Contract review"],
  specialties: ["Commercial"],
  jurisdictions: ["Nigeria"],
  metadata_uri: null,
  metadata_hash: null,
  agent_endpoint_url: "https://review.example.com/themis/contact",
  agent_endpoint_protocol: "themis-service-endpoint-v1" as const,
  agent_endpoint_capabilities: ["INQUIRY", "MATTER_INTAKE"] as const,
  availability: "ACTIVE" as const,
  source: "REAL" as const,
  completed_matter_count: 0,
  created_at: "2026-09-15T00:00:00.000Z",
  updated_at: "2026-09-15T00:00:00.000Z",
};

function serviceClient(data: typeof row[] | typeof row | null) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const request = {
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return request;
    },
    order: (...args: unknown[]) => {
      calls.push({ method: "order", args });
      return request;
    },
    limit: (...args: unknown[]) => {
      calls.push({ method: "limit", args });
      return request;
    },
    ilike: (...args: unknown[]) => {
      calls.push({ method: "ilike", args });
      return request;
    },
    contains: (...args: unknown[]) => {
      calls.push({ method: "contains", args });
      return request;
    },
    maybeSingle: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: null }),
    then: <TResult1 = { data: typeof data; error: null }>(
      onfulfilled?: ((value: { data: typeof data; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    ) => Promise.resolve({ data, error: null }).then(onfulfilled),
  };
  return {
    client: { from: () => ({ select: () => request }) } as unknown as SupabaseClient,
    calls,
  };
}

describe("public service discovery", () => {
  it("filters discovery to active real services and maps only the public profile", async () => {
    const mock = serviceClient([row]);

    const services = await discoverServices(mock.client, {
      query: "Contract",
      service: "Contract review",
      jurisdiction: "Nigeria",
      limit: 10,
    });

    expect(services).toHaveLength(1);
    expect(services[0]).toMatchObject({
      name: "Contract review agent",
      ownerWallet: row.owner_wallet.address,
      integration: { url: row.agent_endpoint_url, capabilities: row.agent_endpoint_capabilities },
    });
    expect(mock.calls).toEqual(expect.arrayContaining([
      { method: "eq", args: ["availability", "ACTIVE"] },
      { method: "eq", args: ["source", "REAL"] },
      { method: "ilike", args: ["name", "%Contract%"] },
      { method: "contains", args: ["services", ["Contract review"]] },
      { method: "contains", args: ["jurisdictions", ["Nigeria"]] },
    ]));
  });

  it("does not turn a missing service into a fake provider profile", async () => {
    const mock = serviceClient(null);
    await expect(getPublicService(mock.client, row.id)).rejects.toMatchObject({ code: "SERVICE_NOT_FOUND" });
  });
});
