import { createThemisA2aAgentCard } from "@/server/a2a-card";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const card = createThemisA2aAgentCard(new URL(request.url).origin);
  return Response.json(card, {
    headers: {
      "cache-control": "public, max-age=300, must-revalidate",
      vary: "Accept",
    },
  });
}
