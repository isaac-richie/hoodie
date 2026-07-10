/**
 * Token & Wallet Routes — metadata and reputation lookups.
 *
 * GET /v1/token/:address    — ERC20 metadata + deployer + LP info
 * GET /v1/deployer/:address — persisted deployer reputation and launch history
 * GET /v1/wallet/:address   — persisted wallet rap sheet when available
 */
import type { FastifyInstance } from "fastify";
import { isAddress } from "viem";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { deployers, scanResults, tokens, wallets } from "../../db/schema.js";
import { resolveTokenMeta } from "../../services/token-meta.js";
import { getSourceVerification } from "../../services/explorer-source.js";
import { sendApiError } from "../errors.js";

export async function tokenRoutes(app: FastifyInstance) {
  app.get("/v1/pulse", async () => {
    const rows = await db
      .select({
        address: tokens.id,
        name: tokens.name,
        symbol: tokens.symbol,
        status: tokens.status,
        deployer: tokens.deployer,
        latestScore: tokens.latestScore,
        latestBand: tokens.latestBand,
        totalScans: tokens.totalScans,
        updatedAt: tokens.updatedAt,
        createdAt: tokens.createdAt,
      })
      .from(tokens)
      .orderBy(desc(tokens.updatedAt))
      .limit(100);

    return { tokens: rows };
  });

  app.get("/v1/deployers", async () => {
    const rows = await db
      .select()
      .from(deployers)
      .orderBy(desc(deployers.updatedAt))
      .limit(100);

    return { deployers: rows };
  });

  app.get<{ Params: { address: string } }>(
    "/v1/source/:address",
    async (req, reply) => {
      const { address } = req.params;
      if (!isAddress(address)) {
        return sendApiError(reply, 422, "INVALID_ADDRESS", "invalid address");
      }

      try {
        const source = await getSourceVerification(address as `0x${string}`);
        return reply.send(source);
      } catch (err) {
        return sendApiError(reply, 500, "UPSTREAM_ERROR", "source lookup failed", {
          message: (err as Error).message,
        });
      }
    }
  );

  // GET /v1/token/:address — token metadata
  app.get<{ Params: { address: string } }>(
    "/v1/token/:address",
    async (req, reply) => {
      const { address } = req.params;
      if (!isAddress(address)) {
        return sendApiError(reply, 422, "INVALID_ADDRESS", "invalid address");
      }

      try {
        const meta = await resolveTokenMeta(address as `0x${string}`);
        const [tokenRow] = await db.select().from(tokens).where(eq(tokens.id, address.toLowerCase())).limit(1);
        const recentScans = await db
          .select()
          .from(scanResults)
          .where(eq(scanResults.tokenAddress, address.toLowerCase()))
          .orderBy(desc(scanResults.createdAt))
          .limit(5);

        return reply.send({ ...meta, token: tokenRow ?? null, recentScans });
      } catch (err) {
        return sendApiError(reply, 500, "UPSTREAM_ERROR", "token lookup failed", {
          message: (err as Error).message,
        });
      }
    }
  );

  // GET /v1/deployer/:address — deployer reputation
  app.get<{ Params: { address: string } }>(
    "/v1/deployer/:address",
    async (req, reply) => {
      const { address } = req.params;
      if (!isAddress(address)) {
        return sendApiError(reply, 422, "INVALID_ADDRESS", "invalid address");
      }

      const normalized = address.toLowerCase();
      const [deployer] = await db.select().from(deployers).where(eq(deployers.address, normalized)).limit(1);
      const launches = await db
        .select()
        .from(tokens)
        .where(eq(tokens.deployer, normalized))
        .orderBy(desc(tokens.updatedAt))
        .limit(50);

      return reply.send({ address: normalized, deployer: deployer ?? null, launches });
    }
  );

  // GET /v1/wallet/:address — wallet rap sheet
  app.get<{ Params: { address: string } }>(
    "/v1/wallet/:address",
    async (req, reply) => {
      const { address } = req.params;
      if (!isAddress(address)) {
        return sendApiError(reply, 422, "INVALID_ADDRESS", "invalid address");
      }

      const normalized = address.toLowerCase();
      const [wallet] = await db.select().from(wallets).where(eq(wallets.address, normalized)).limit(1);
      return reply.send({ address: normalized, wallet: wallet ?? null });
    }
  );
}
