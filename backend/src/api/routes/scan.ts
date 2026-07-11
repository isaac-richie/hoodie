/**
 * Scan Routes — core API endpoints for token risk analysis.
 *
 * POST /v1/analyze  — full scan, accepts { token: "0x..." } body
 * GET  /v1/scan/:address — same scan, GET-friendly for browser/curl
 * GET  /v1/score/:address — lightweight: just score + band (no module details)
 *
 * Returns 206 Partial Content if some modules timed out (scan still usable).
 * All endpoints validate the address is a valid EVM address before scanning.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scanToken } from "../../engine/scanner.js";
import { isAddress } from "viem";
import { sendApiError } from "../errors.js";
import { applyModuleGate, enforceScanQuota, requireScope } from "../product-rules.js";
import { withScanSlot, ScanOverloadedError } from "../scan-limiter.js";
import { logger } from "../../utils/logger.js";

const scanBodySchema = z.object({
  token: z.string().refine((v) => isAddress(v), "Invalid token address"),
  fresh: z.boolean().optional(),
});

function wantsFresh(query: unknown): boolean {
  const fresh = (query as Record<string, unknown> | undefined)?.fresh;
  return fresh === "1" || fresh === "true";
}

function handleScanError(reply: Parameters<typeof sendApiError>[0], err: unknown) {
  if (err instanceof ScanOverloadedError) {
    return sendApiError(reply, 503, "SCAN_OVERLOADED", "scanner is busy — try again in a moment");
  }
  // Log the real error server-side; never echo raw internals (provider URLs,
  // library error text) to the client.
  logger.error({ err }, "scan failed");
  return sendApiError(reply, 500, "SCAN_FAILED", "the scan hit an unexpected error — try again in a moment");
}

export async function scanRoutes(app: FastifyInstance) {
  // POST /v1/analyze — full scan engine
  app.post("/v1/analyze", async (req, reply) => {
    const body = scanBodySchema.safeParse(req.body);
    if (!body.success) {
      return sendApiError(
        reply,
        422,
        "INVALID_ADDRESS",
        "not a token we can read. check the address",
        body.error.issues
      );
    }
    if (!requireScope(req, reply, "scan:read")) return;
    if (!(await enforceScanQuota(req, reply))) return;

    try {
      const rawResult = await withScanSlot(() =>
        scanToken(body.data.token as `0x${string}`, { fresh: body.data.fresh === true })
      );
      const result = applyModuleGate(rawResult, req);

      // Check if partial (some modules timed out)
      if (result.modulesRan < result.modulesTotal) {
        reply.status(206);
      }

      return reply.send(result);
    } catch (err) {
      return handleScanError(reply, err);
    }
  });

  // GET /v1/scan/:address — same thing, GET-friendly
  app.get<{ Params: { address: string } }>(
    "/v1/scan/:address",
    async (req, reply) => {
      const { address } = req.params;
      if (!isAddress(address)) {
        return sendApiError(reply, 422, "INVALID_ADDRESS", "invalid address");
      }
      if (!requireScope(req, reply, "scan:read")) return;
      if (!(await enforceScanQuota(req, reply))) return;

      try {
        const rawResult = await withScanSlot(() =>
          scanToken(address as `0x${string}`, { fresh: wantsFresh(req.query) })
        );
        const result = applyModuleGate(rawResult, req);

        if (result.modulesRan < result.modulesTotal) {
          reply.status(206);
        }

        return reply.send(result);
      } catch (err) {
        return handleScanError(reply, err);
      }
    }
  );

  // GET /v1/score/:address — lightweight: just score + band
  app.get<{ Params: { address: string } }>(
    "/v1/score/:address",
    async (req, reply) => {
      const { address } = req.params;
      if (!isAddress(address)) {
        return sendApiError(reply, 422, "INVALID_ADDRESS", "invalid address");
      }
      if (!requireScope(req, reply, "scan:read")) return;
      // This runs a full scan under the hood — meter it like the others, or it
      // becomes a free, unlimited way to drive RPC-heavy scans.
      if (!(await enforceScanQuota(req, reply))) return;

      try {
        const result = await withScanSlot(() => scanToken(address as `0x${string}`));
        return reply.send({
          token: address,
          score: result.score,
          band: result.band,
          confidence: result.confidence,
          modulesRan: result.modulesRan,
          modulesTotal: result.modulesTotal,
        });
      } catch (err) {
        return handleScanError(reply, err);
      }
    }
  );
}
