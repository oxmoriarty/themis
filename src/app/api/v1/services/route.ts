import { errorResponse } from "@/server/errors";
import { discoverServices, registerServiceProfile } from "@/server/services";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const services = await discoverServices(createServiceSupabaseClient(), query);
    return Response.json({ services });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const service = await registerServiceProfile(createServiceSupabaseClient(), userId, await request.json());
    return Response.json({ service }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
