export function GET(): Response {
  return Response.json({
    status: "ok",
    scope: "repository-and-data-model",
  });
}

