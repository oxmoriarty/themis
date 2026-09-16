import { describe, expect, it, vi } from "vitest";

import { A2aClient, A2aClientError } from "@/sdk/a2a-client";
import { a2aAgentCardSchema } from "@/domain/a2a";

const task = {
  id: "11111111-1111-4111-8111-111111111111",
  status: { state: "TASK_STATE_COMPLETED", timestamp: "2026-09-16T00:00:00.000Z" },
  history: [],
};
const card = a2aAgentCardSchema.parse({
  name: "Provider agent",
  description: "A bounded test agent.",
  version: "1.0.0",
  supportedInterfaces: [{ url: "https://provider.example.com/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
  capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
  defaultInputModes: ["application/json"],
  defaultOutputModes: ["application/json"],
  skills: [{ id: "review", name: "Review", description: "Review a request.", tags: ["review"], inputModes: ["application/json"], outputModes: ["application/json"] }],
});

describe("A2aClient", () => {
  it("discovers a valid A2A v1 card without forwarding credentials", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(card)));
    const client = new A2aClient({ fetch: fetchImplementation });

    await expect(client.discover("https://provider.example.com/.well-known/agent-card.json")).resolves.toMatchObject({ name: card.name });
    const init = fetchImplementation.mock.calls[0]?.[1] as NonNullable<Parameters<typeof fetch>[1]>;
    expect(new Headers(init.headers).get("authorization")).toBeNull();
    expect(init.credentials).toBe("omit");
  });

  it("uses current JSON-RPC method names and only sends an explicitly supplied provider token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { task } }));
    });
    const client = new A2aClient({ fetch: fetchImplementation });
    const result = await client.sendMessage(card, {
      message: { role: "ROLE_USER", messageId: "22222222-2222-4222-8222-222222222222", parts: [{ data: { operation: "DISCOVER_SERVICES" } }] },
    }, { accessToken: "provider-scoped-token" });

    expect(result.id).toBe(task.id);
    const init = fetchImplementation.mock.calls[0]?.[1] as NonNullable<Parameters<typeof fetch>[1]>;
    expect(JSON.parse(String(init.body))).toMatchObject({ method: "SendMessage", jsonrpc: "2.0" });
    expect(new Headers(init.headers).get("a2a-version")).toBe("1.0");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer provider-scoped-token");
    expect(init.credentials).toBe("omit");
  });

  it("fails closed for an invalid card or an A2A protocol error", async () => {
    const invalidCard = new A2aClient({ fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ name: "missing fields" }))) });
    await expect(invalidCard.discover("https://provider.example.com/.well-known/agent-card.json")).rejects.toBeInstanceOf(A2aClientError);

    const denied = new A2aClient({ fetch: vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32001, message: "Task not found" } }), { status: 404 });
    }) });
    await expect(denied.getTask(card, { id: task.id })).rejects.toMatchObject({ code: "A2A_-32001", status: 404 });
  });
});
