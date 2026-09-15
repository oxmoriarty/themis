import { z } from "zod";

import { verifyWalletChallenge } from "@/server/auth-challenge";
import { errorResponse } from "@/server/errors";
import { SupabaseWalletChallengeRepository } from "@/server/repositories";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

const requestSchema = z.object({ challengeId: z.string().uuid(), signature: z.string() });

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const body = requestSchema.parse(await request.json());
    const identity = await verifyWalletChallenge(
      new SupabaseWalletChallengeRepository(createServiceSupabaseClient()),
      { userId, ...body },
    );

    return Response.json({ walletIdentityId: identity.id, walletAddress: identity.address });
  } catch (error) {
    return errorResponse(error);
  }
}
