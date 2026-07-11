import type { FastifyReply, FastifyRequest } from "fastify";
import { sendApiError } from "../errors.js";

const CSRF_HEADER = "x-hood-csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie sessions are browser credentials, so state-changing requests need a
 * non-simple custom header. Cross-site forms cannot send this header, and
 * cross-site fetches must pass CORS preflight first.
 */
export async function csrfMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;
  if ((request as any).authType !== "session") return;

  const header = request.headers[CSRF_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  if (value === "1") return;

  return sendApiError(reply, 403, "CSRF_REQUIRED", "missing CSRF header", {
    header: CSRF_HEADER,
  });
}
