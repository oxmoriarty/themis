import { z } from "zod";

import { errorResponse } from "@/server/errors";
import { stageConsensusEvidence } from "@/server/consensus-evidence";
import { requireMatterAccess } from "@/server/matters";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

const paramsSchema = z.object({ matterId: z.string().uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
): Promise<Response> {
  try {
    const { matterId } = paramsSchema.parse(await context.params);
    const userId = await requireAuthenticatedUserId(request);
    const client = createServiceSupabaseClient();
    const access = await requireMatterAccess(client, userId, matterId);
    const entry = await stageConsensusEvidence(client, matterId, access.walletIdentityId, await request.json());

    return Response.json({
      entry,
      warning: "This is an acknowledged off-chain staging record, not a GenLayer submission or adjudication input.",
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
