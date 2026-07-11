import type { FastifyReply } from "fastify";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "INVALID_ADDRESS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NONCE_EXPIRED"
  | "BAD_SIGNATURE"
  | "NOT_FOUND"
  | "SCAN_FAILED"
  | "SCAN_OVERLOADED"
  | "UPSTREAM_ERROR"
  | "SCOPE_REQUIRED"
  | "SCAN_QUOTA_EXCEEDED"
  | "RATE_LIMITED";

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown
) {
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };

  return reply.status(statusCode).send(body);
}
