import { z } from "zod";

import { getChallengeTtlSeconds, parseConfiguredAppOrigin } from "@/server/api-schemas";
import { createWalletChallenge } from "@/server/auth-challenge";
import { errorResponse } from "@/server/errors";
import { SupabaseWalletChallengeRepository } from "@/server/repositories";
import { createServiceSupabaseClient, requireAuthenticatedUserId } from "@/server/supabase";

const requestSchema = z.object({ walletAddress: z.string() });

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireAuthenticatedUserId(request);
    const body = requestSchema.parse(await request.json());
    const challenge = await createWalletChallenge(
      new SupabaseWalletChallengeRepository(createServiceSupabaseClient()),
      {
        userId,
        walletAddress: body.walletAddress,
        domain: parseConfiguredAppOrigin(),
        ttlSeconds: getChallengeTtlSeconds(),
      },
    );

    return Response.json({
      challengeId: challenge.id,
      statement: challenge.statement,
      expiresAt: challenge.expiresAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
