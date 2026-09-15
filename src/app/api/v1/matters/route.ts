import { errorResponse } from "@/server/errors";
import { createMatterDraft } from "@/server/matters";
import { getMatterStatus } from "@/server/matter-status";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const client = createServiceSupabaseClient();
    const created = await createMatterDraft(client, userId, await request.json());
    const matter = await getMatterStatus(client, userId, (created as { id: string }).id);
    return Response.json({ matter }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
