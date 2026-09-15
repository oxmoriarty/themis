import { z } from "zod";

import { errorResponse } from "@/server/errors";
import { createPrivateEvidenceDownloadUrl } from "@/server/private-evidence";
import { requireMatterAccess } from "@/server/matters";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

const paramsSchema = z.object({ matterId: z.string().uuid(), evidenceId: z.string().uuid() });

export async function GET(
  request: Request,
  context: { params: Promise<{ matterId: string; evidenceId: string }> },
): Promise<Response> {
  try {
    const { matterId, evidenceId } = paramsSchema.parse(await context.params);
    const userId = await requireAuthenticatedUserId(request);
    const client = createServiceSupabaseClient();
    await requireMatterAccess(client, userId, matterId);
    return Response.json(await createPrivateEvidenceDownloadUrl(client, matterId, evidenceId));
  } catch (error) {
    return errorResponse(error);
  }
}
