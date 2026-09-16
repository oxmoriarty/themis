import { errorResponse } from "@/server/errors";
import { getOwnedServices } from "@/server/services";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

export async function GET(request: Request): Promise<Response> {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const services = await getOwnedServices(createServiceSupabaseClient(), userId);
    return Response.json({ services });
  } catch (error) {
    return errorResponse(error);
  }
}
