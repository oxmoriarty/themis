import { z } from "zod";

import { storePrivateEvidence } from "@/server/private-evidence";
import { errorResponse, ApiError } from "@/server/errors";
import { requireMatterAccess } from "@/server/matters";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

const paramsSchema = z.object({ matterId: z.string().uuid() });

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ matterId: string }> },
): Promise<Response> {
  try {
    const { matterId } = paramsSchema.parse(await context.params);
    const userId = await requireAuthenticatedUserId(request);
    const client = createServiceSupabaseClient();
    const access = await requireMatterAccess(client, userId, matterId);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "INVALID_REQUEST", "Provide one evidence file in the 'file' field.");
    }

    const evidence = await storePrivateEvidence(
      client,
      {
        matterId,
        originalFilename: file.name,
        declaredMimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      },
      access.walletIdentityId,
    );

    return Response.json({ evidence }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
