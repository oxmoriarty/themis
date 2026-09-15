import { z } from "zod";

import { errorResponse } from "@/server/errors";
import { getMatterStatus } from "@/server/matter-status";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

const paramsSchema = z.object({ matterId: z.string().uuid() });

export async function GET(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
): Promise<Response> {
  try {
    const { matterId } = paramsSchema.parse(await context.params);
    const userId = await requireAuthenticatedUserId(request);
    const matter = await getMatterStatus(createServiceSupabaseClient(), userId, matterId);
    return Response.json({ matter });
  } catch (error) {
    return errorResponse(error);
  }
}
