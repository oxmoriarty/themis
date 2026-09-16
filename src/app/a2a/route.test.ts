import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase", () => ({
  createServiceSupabaseClient: vi.fn(),
  requireAuthenticatedUserId: vi.fn(),
}));

import { GET as getCard } from "@/app/.well-known/agent-card.json/route";
import { POST } from "@/app/a2a/route";
import { requireAuthenticatedUserId } from "@/server/supabase";

describe("A2A routes", () => {
  it("publishes a cacheable A2A 1.0 Agent Card", async () => {
    const response = getCard(new Request("https://themis.example/.well-known/agent-card.json"));
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    await expect(response.json()).resolves.toMatchObject({
      supportedInterfaces: [{ url: "https://themis.example/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
      capabilities: { streaming: false, pushNotifications: false },
    });
  });

  it("uses JSON-RPC parse and authentication errors instead of an HTTP success body", async () => {
    const malformed = await POST(new Request("https://themis.example/a2a", { method: "POST", body: "not-json" }));
    expect(await malformed.json()).toMatchObject({ error: { code: -32700 } });

    vi.mocked(requireAuthenticatedUserId).mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "UNAUTHENTICATED" }));
    const unauthenticated = await POST(new Request("https://themis.example/a2a", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "GetTask", params: { id: "11111111-1111-4111-8111-111111111111" } }) }));
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ id: 1, error: { code: -32000, data: [{ reason: "UNAUTHENTICATED" }] } });
  });
});
