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
  if (!authenticatedUserId) return true;

  if (authenticatedUserId.toLowerCase() !== userId.toLowerCase()) {
    sendApiError(reply, 403, "FORBIDDEN", "user does not own this resource");
    return false;
  }

  return true;
}
