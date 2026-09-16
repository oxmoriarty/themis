import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getA2aTask, listA2aTasks, sendA2aMessage } from "@/server/a2a";

function a2aClient() {
  const tasks: Array<{ id: string; user_id: string; message_id: string; task: unknown; updated_at: string }> = [];
  const taskQuery = (rows: typeof tasks) => {
    const request = {
      eq: (column: string, value: string) => taskQuery(rows.filter((row) => String(row[column as keyof typeof row]) === value)),
      order: () => request,
      limit: () => request,
      lt: () => request,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: <TResult1 = { data: typeof rows; error: null }>(onfulfilled?: ((value: { data: typeof rows; error: null }) => TResult1 | PromiseLike<TResult1>) | null) => Promise.resolve({ data: rows, error: null }).then(onfulfilled),
    };
    return request;
  };
  return {
    client: {
      from: (table: string) => {
        if (table === "a2a_tasks") return {
          select: () => taskQuery(tasks),
          insert: async (row: typeof tasks[number]) => { tasks.push({ ...row, updated_at: "2026-09-16T00:00:00.000Z" }); return { error: null }; },
          update: (patch: Partial<typeof tasks[number]>) => ({ eq: () => ({ eq: async () => { Object.assign(tasks[tasks.length - 1]!, patch); return { error: null }; } }) }),
        };
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) };
      },
    } as unknown as SupabaseClient,
    tasks,
  };
}

describe("Themis A2A task service", () => {
  it("persists a completed structured discovery task and returns it idempotently", async () => {
    const mock = a2aClient();
    const input = { message: { role: "ROLE_USER", messageId: "22222222-2222-4222-8222-222222222222", parts: [{ data: { operation: "DISCOVER_SERVICES" } }] } };
    const first = await sendA2aMessage(mock.client, "user-1", input);
    const repeated = await sendA2aMessage(mock.client, "user-1", input);

    expect(first.status.state).toBe("TASK_STATE_COMPLETED");
    expect(first.artifacts?.[0]?.parts[0]).toMatchObject({ data: { operation: "DISCOVER_SERVICES" } });
    expect(repeated.id).toBe(first.id);
    expect(mock.tasks).toHaveLength(1);
  });

  it("does not reveal a task to a different A2A caller", async () => {
    const mock = a2aClient();
    const task = await sendA2aMessage(mock.client, "user-1", { message: { role: "ROLE_USER", messageId: "22222222-2222-4222-8222-222222222222", parts: [{ data: { operation: "DISCOVER_SERVICES" } }] } });
    await expect(getA2aTask(mock.client, "user-2", { id: task.id })).rejects.toMatchObject({ reason: "TASK_NOT_FOUND" });
  });

  it("omits artifacts by default when listing caller-scoped tasks", async () => {
    const mock = a2aClient();
    await sendA2aMessage(mock.client, "user-1", { message: { role: "ROLE_USER", messageId: "22222222-2222-4222-8222-222222222222", parts: [{ data: { operation: "DISCOVER_SERVICES" } }] } });
    const result = await listA2aTasks(mock.client, "user-1", {});
    expect(result.nextPageToken).toBe("");
    expect(result.tasks[0]).not.toHaveProperty("artifacts");
  });
});
