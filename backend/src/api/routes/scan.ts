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

const scanBodySchema = z.object({
  token: z.string().refine((v) => isAddress(v), "Invalid token address"),
});

export async function scanRoutes(app: FastifyInstance) {
  // POST /v1/analyze — full 31-module scan
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
      const rawResult = await scanToken(body.data.token as `0x${string}`);
      const result = applyModuleGate(rawResult, req);

      // Check if partial (some modules timed out)
      if (result.modulesRan < result.modulesTotal) {
        reply.status(206);
      }

      return reply.send(result);
    } catch (err) {
      return sendApiError(reply, 500, "SCAN_FAILED", "scan failed", {
        message: (err as Error).message,
      });
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
        const rawResult = await scanToken(address as `0x${string}`);
        const result = applyModuleGate(rawResult, req);

        if (result.modulesRan < result.modulesTotal) {
          reply.status(206);
        }

        return reply.send(result);
      } catch (err) {
        return sendApiError(reply, 500, "SCAN_FAILED", "scan failed", {
          message: (err as Error).message,
        });
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

      try {
        const result = await scanToken(address as `0x${string}`);
        return reply.send({
          token: address,
          score: result.score,
          band: result.band,
          confidence: result.confidence,
          modulesRan: result.modulesRan,
          modulesTotal: result.modulesTotal,
        });
      } catch (err) {
        return sendApiError(reply, 500, "SCAN_FAILED", "scan failed", {
          message: (err as Error).message,
        });
      }
    }
  );
}
