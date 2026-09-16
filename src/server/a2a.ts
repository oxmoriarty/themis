import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createMatterDraft } from "@/server/matters";
import { discoverServices } from "@/server/services";
import {
  a2aGetTaskParamsSchema,
  a2aListTasksParamsSchema,
  a2aSendMessageParamsSchema,
  a2aTaskSchema,
  type A2aTask,
} from "@/domain/a2a";

const taskRowSchema = z.object({ task: a2aTaskSchema, updated_at: z.string().min(1) });
const taskOperationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("DISCOVER_SERVICES"), query: z.string().trim().min(1).max(120).optional(), service: z.string().trim().min(1).max(80).optional(), jurisdiction: z.string().trim().min(1).max(80).optional(), limit: z.number().int().min(1).max(50).optional() }).strict(),
  z.object({ operation: z.literal("CREATE_MATTER_DRAFT"), title: z.string().trim().min(1).max(160), privateDescription: z.string().trim().min(1).max(8_000), providerWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/), serviceId: z.string().uuid() }).strict(),
]);

export class A2aProtocolError extends Error {
  public constructor(public readonly code: number, message: string, public readonly reason: string) {
    super(message);
    this.name = "A2aProtocolError";
  }
}

function workingTask(input: z.output<typeof a2aSendMessageParamsSchema>): A2aTask {
  const now = new Date().toISOString();
  const taskId = crypto.randomUUID();
  return {
    id: taskId,
    contextId: input.message.contextId ?? crypto.randomUUID(),
    status: { state: "TASK_STATE_WORKING", timestamp: now },
    history: [{ ...input.message, taskId }],
  };
}

function completedTask(task: A2aTask, operationResult: Record<string, unknown>): A2aTask {
  const now = new Date().toISOString();
  const responseMessage = {
    role: "ROLE_AGENT" as const,
    messageId: crypto.randomUUID(),
    taskId: task.id,
    contextId: task.contextId,
    parts: [{ data: { kind: "themis.a2a.result.v1", ...operationResult } }],
  };
  return {
    ...task,
    status: { state: "TASK_STATE_COMPLETED", timestamp: now, message: responseMessage },
    artifacts: [{ artifactId: crypto.randomUUID(), name: "themis-result", parts: responseMessage.parts }],
    history: [...(task.history ?? []), responseMessage],
  };
}

function taskNotFound(): never {
  throw new A2aProtocolError(-32001, "Task not found", "TASK_NOT_FOUND");
}

function limitedHistory(task: A2aTask, historyLength: number | undefined): A2aTask {
  if (historyLength === undefined || !task.history) return task;
  return { ...task, history: historyLength === 0 ? [] : task.history.slice(-historyLength) };
}

async function existingForMessage(client: SupabaseClient, userId: string, messageId: string) {
  const { data, error } = await client.from("a2a_tasks").select("task, updated_at")
    .eq("user_id", userId).eq("message_id", messageId).maybeSingle();
  if (error) throw new Error("Could not read A2A task.");
  return data ? taskRowSchema.parse(data).task : null;
}

export async function sendA2aMessage(client: SupabaseClient, userId: string, rawParams: unknown): Promise<A2aTask> {
  const input = a2aSendMessageParamsSchema.parse(rawParams);
  if (input.message.role !== "ROLE_USER" || input.message.taskId) {
    throw new A2aProtocolError(-32602, "Invalid parameters", "INVALID_MESSAGE");
  }
  if (input.configuration?.acceptedOutputModes && !input.configuration.acceptedOutputModes.includes("application/json")) {
    throw new A2aProtocolError(-32005, "Content type is not supported", "CONTENT_TYPE_NOT_SUPPORTED");
  }
  const repeated = await existingForMessage(client, userId, input.message.messageId);
  if (repeated) return limitedHistory(repeated, input.configuration?.historyLength);

  const dataParts = input.message.parts.filter((part): part is { data: Record<string, unknown> } => "data" in part
    && part.data !== null && typeof part.data === "object" && !Array.isArray(part.data));
  if (dataParts.length !== 1 || input.message.parts.length !== 1) {
    throw new A2aProtocolError(-32602, "Invalid parameters", "STRUCTURED_OPERATION_REQUIRED");
  }
  const operation = taskOperationSchema.parse(dataParts[0].data);
  const task = workingTask(input);
  const { error: insertError } = await client.from("a2a_tasks").insert({
    id: task.id,
    user_id: userId,
    message_id: input.message.messageId,
    context_id: task.contextId ?? null,
    status: "TASK_STATE_WORKING",
    task,
  });
  if (insertError?.code === "23505") {
    const afterRace = await existingForMessage(client, userId, input.message.messageId);
    if (afterRace) return afterRace;
  }
  if (insertError) throw new Error("Could not persist A2A task.");

  try {
    const result = operation.operation === "DISCOVER_SERVICES"
      ? (() => {
        const { operation: _operation, ...query } = operation;
        return discoverServices(client, query).then((services) => ({ operation: "DISCOVER_SERVICES" as const, services }));
      })()
      : (() => {
        const { operation: _operation, ...matterInput } = operation;
        return createMatterDraft(client, userId, matterInput).then((matter) => ({ operation: "CREATE_MATTER_DRAFT" as const, matter }));
      })();
    const completed = completedTask(task, await result);
    const { error: updateError } = await client.from("a2a_tasks").update({ status: completed.status.state, task: completed }).eq("id", task.id).eq("user_id", userId);
    if (updateError) throw new Error("Could not finalize A2A task.");
    return limitedHistory(completed, input.configuration?.historyLength);
  } catch (error) {
    const failed: A2aTask = { ...task, status: { state: "TASK_STATE_FAILED", timestamp: new Date().toISOString() } };
    await client.from("a2a_tasks").update({ status: failed.status.state, task: failed }).eq("id", task.id).eq("user_id", userId);
    throw error;
  }
}

export async function getA2aTask(client: SupabaseClient, userId: string, rawParams: unknown): Promise<A2aTask> {
  const params = a2aGetTaskParamsSchema.parse(rawParams);
  const { data, error } = await client.from("a2a_tasks").select("task, updated_at")
    .eq("id", params.id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not read A2A task.");
  if (!data) taskNotFound();
  const task = taskRowSchema.parse(data).task;
  return limitedHistory(task, params.historyLength);
}

export async function listA2aTasks(client: SupabaseClient, userId: string, rawParams: unknown) {
  const params = a2aListTasksParamsSchema.parse(rawParams);
  if (params.pageToken && Number.isNaN(Date.parse(params.pageToken))) {
    throw new A2aProtocolError(-32602, "Invalid parameters", "INVALID_PAGE_TOKEN");
  }
  const pageSize = params.pageSize ?? 20;
  let query = client.from("a2a_tasks").select("task, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(pageSize + 1);
  if (params.contextId) query = query.eq("context_id", params.contextId);
  if (params.pageToken) query = query.lt("updated_at", params.pageToken);
  const { data, error } = await query;
  if (error) throw new Error("Could not list A2A tasks.");
  const rows = (data ?? []).map((row) => taskRowSchema.parse(row));
  const more = rows.length > pageSize;
  const tasks = rows.slice(0, pageSize).map(({ task }) => {
    if (params.includeArtifacts) return task;
    const { artifacts: _artifacts, ...withoutArtifacts } = task;
    return withoutArtifacts;
  });
  return { tasks, nextPageToken: more ? rows[pageSize - 1]!.updated_at : "" };
}

export async function cancelA2aTask(client: SupabaseClient, userId: string, rawParams: unknown): Promise<A2aTask> {
  const params = a2aGetTaskParamsSchema.pick({ id: true }).parse(rawParams);
  await getA2aTask(client, userId, params);
  throw new A2aProtocolError(-32002, "Task is not cancelable", "TASK_NOT_CANCELABLE");
}
