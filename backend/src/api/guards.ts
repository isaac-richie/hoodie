import type { FastifyReply, FastifyRequest } from "fastify";
import { sendApiError } from "./errors.js";

export function getRequestUserId(request: FastifyRequest): string | undefined {
  return (request as any).userId;
}

export function isAuthenticated(request: FastifyRequest): boolean {
  return Boolean((request as any).userId || (request as any).apiKeyId);
}

export function assertUserAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string
): boolean {
  const authenticatedUserId = getRequestUserId(request);

  // Fail closed: an unauthenticated request must never be treated as the owner
  // of a per-user resource. The previous `return true` here meant that with
  // auth disabled (or no session) anyone could read/write any user's data.
  if (!authenticatedUserId) {
    sendApiError(reply, 401, "UNAUTHORIZED", "sign in to access this resource");
    return false;
  }

  if (authenticatedUserId.toLowerCase() !== userId.toLowerCase()) {
    sendApiError(reply, 403, "FORBIDDEN", "user does not own this resource");
    return false;
  }

  return true;
}
