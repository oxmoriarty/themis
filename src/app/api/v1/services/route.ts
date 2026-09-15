import { errorResponse } from "@/server/errors";
import { discoverServices } from "@/server/services";
import { createServiceSupabaseClient } from "@/server/supabase";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const services = await discoverServices(createServiceSupabaseClient(), query);
    return Response.json({ services });
  } catch (error) {
    return errorResponse(error);
  }
}
