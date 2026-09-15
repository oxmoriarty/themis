import { z } from "zod";

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class AuthenticationError extends ApiError {
  public constructor(message = "A valid authenticated session is required.") {
    super(401, "UNAUTHENTICATED", message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ApiError {
  public constructor(message = "You are not authorized to access this matter.") {
    super(403, "FORBIDDEN", message);
    this.name = "AuthorizationError";
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new ApiError(400, "INVALID_REQUEST", "The request payload is invalid.");
  }

  return new ApiError(500, "INTERNAL_ERROR", "The server could not complete the request.");
}

export function errorResponse(error: unknown): Response {
  const apiError = toApiError(error);
  return Response.json(
    { error: { code: apiError.code, message: apiError.message } },
    { status: apiError.status },
  );
}
