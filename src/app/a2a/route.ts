import { z } from "zod";

import { A2aProtocolError, cancelA2aTask, getA2aTask, listA2aTasks, sendA2aMessage } from "@/server/a2a";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

export const dynamic = "force-dynamic";

const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().min(1).max(160), z.number().finite(), z.null()]),
  method: z.string().min(1).max(120),
  params: z.unknown().optional(),
}).strict();

type JsonRpcId = string | number | null;

function rpcResponse(id: JsonRpcId, result: unknown, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id, result }, { status, headers: { "A2A-Version": "1.0" } });
}

function rpcError(id: JsonRpcId, code: number, message: string, reason: string, status = 200): Response {
  return Response.json({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data: [{
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason,
        domain: "a2a-protocol.org",
      }],
    },
  }, { status, headers: { "A2A-Version": "1.0" } });
}

function unsupported(id: JsonRpcId): Response {
  return rpcError(id, -32004, "Operation is not supported", "UNSUPPORTED_OPERATION", 400);
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return rpcError(null, -32700, "Invalid JSON payload", "JSON_PARSE_ERROR", 400);
  }
  const parsed = jsonRpcRequestSchema.safeParse(raw);
  if (!parsed.success) return rpcError(null, -32600, "Request payload validation error", "INVALID_REQUEST", 400);
  const rpc = parsed.data;
  if (rpc.id === null) return rpcError(null, -32600, "Request payload validation error", "NOTIFICATIONS_UNSUPPORTED", 400);
  if (request.headers.get("a2a-version") && request.headers.get("a2a-version") !== "1.0") {
    return rpcError(rpc.id, -32009, "A2A version is not supported", "VERSION_NOT_SUPPORTED", 400);
  }
  if (!["SendMessage", "GetTask", "ListTasks", "CancelTask"].includes(rpc.method)) {
    return unsupported(rpc.id);
  }

  try {
    const userId = await requireAuthenticatedUserId(request);
    const client = createServiceSupabaseClient();
    if (rpc.method === "SendMessage") return rpcResponse(rpc.id, { task: await sendA2aMessage(client, userId, rpc.params) });
    if (rpc.method === "GetTask") return rpcResponse(rpc.id, await getA2aTask(client, userId, rpc.params));
    if (rpc.method === "ListTasks") return rpcResponse(rpc.id, await listA2aTasks(client, userId, rpc.params));
    return rpcResponse(rpc.id, await cancelA2aTask(client, userId, rpc.params));
  } catch (error) {
    if (error instanceof A2aProtocolError) return rpcError(rpc.id, error.code, error.message, error.reason);
    if (error instanceof z.ZodError) return rpcError(rpc.id, -32602, "Invalid parameters", "INVALID_PARAMS");
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "UNAUTHENTICATED") {
      return rpcError(rpc.id, -32000, "Authentication required", "UNAUTHENTICATED", 401);
    }
    return rpcError(rpc.id, -32603, "Internal error", "INTERNAL_ERROR", 500);
  }
}
