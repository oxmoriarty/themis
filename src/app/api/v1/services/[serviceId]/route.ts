import { z } from "zod";

import { errorResponse } from "@/server/errors";
import { getPublicService } from "@/server/services";
import { createServiceSupabaseClient } from "@/server/supabase";

const paramsSchema = z.object({ serviceId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ serviceId: string }> },
): Promise<Response> {
  try {
    const { serviceId } = paramsSchema.parse(await context.params);
    const service = await getPublicService(createServiceSupabaseClient(), serviceId);
    return Response.json({ service });
  } catch (error) {
    return errorResponse(error);
  }
}
