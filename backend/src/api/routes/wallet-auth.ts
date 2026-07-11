import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { isAddress, verifyMessage } from "viem";
import { z } from "zod";
import { redis } from "../../config/redis.js";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { sendApiError } from "../errors.js";
import { scopesForTier } from "../product-rules.js";
import { clearSessionCookie, createSessionToken, readSession, setSessionCookie } from "../session.js";

const NONCE_TTL_SECONDS = 300;

const nonceSchema = z.object({
  walletAddress: z.string().refine((value) => isAddress(value), "Invalid wallet address"),
});

const verifySchema = nonceSchema.extend({
  signature: z.string().min(1),
});

export async function walletAuthRoutes(app: FastifyInstance) {
  app.post("/v1/auth/wallet/nonce", async (req, reply) => {
    const body = nonceSchema.safeParse(req.body);
    if (!body.success) {
      return sendApiError(reply, 422, "BAD_REQUEST", "invalid nonce request", body.error.issues);
    }

    const walletAddress = body.data.walletAddress.toLowerCase();
    const nonce = randomBytes(16).toString("hex");
    const message = buildWalletLoginMessage(walletAddress, nonce);

    await redis.setex(nonceKey(walletAddress), NONCE_TTL_SECONDS, nonce);
    return reply.send({ walletAddress, nonce, message, expiresIn: NONCE_TTL_SECONDS });
  });

  app.post("/v1/auth/wallet/verify", async (req, reply) => {
    const body = verifySchema.safeParse(req.body);
    if (!body.success) {
      return sendApiError(reply, 422, "BAD_REQUEST", "invalid wallet verification", body.error.issues);
    }

    const walletAddress = body.data.walletAddress.toLowerCase();
    const nonce = await redis.get(nonceKey(walletAddress));
    if (!nonce) {
      return sendApiError(reply, 401, "NONCE_EXPIRED", "wallet nonce expired or missing");
    }

    const message = buildWalletLoginMessage(walletAddress, nonce);
    // verifyMessage THROWS on structurally malformed signatures (bad length,
    // bad v value) rather than returning false — without this catch a garbage
    // signature produced a 500 that leaked the raw viem error to clients.
    let valid = false;
    try {
      valid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: body.data.signature as `0x${string}`,
      });
    } catch {
      valid = false;
    }

    if (!valid) {
      return sendApiError(reply, 401, "BAD_SIGNATURE", "wallet signature did not match");
    }

    await redis.del(nonceKey(walletAddress));

    const [user] = await db
      .insert(users)
      .values({
        id: walletAddress,
        walletAddress,
        tier: "free",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          walletAddress,
          updatedAt: new Date(),
        },
      })
      .returning();

    const token = createSessionToken({
      userId: user.id,
      walletAddress: user.walletAddress ?? walletAddress,
      tier: user.tier,
      scopes: scopesForTier(user.tier),
    });
    setSessionCookie(reply, token);

    return reply.send({ user, verified: true });
  });

  app.get("/v1/auth/session", async (req, reply) => {
    const session = readSession(req);
    if (!session) return sendApiError(reply, 401, "UNAUTHORIZED", "no active wallet session");

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    return reply.send({ user: user ?? null, session });
  });

  app.post("/v1/auth/logout", async (_req, reply) => {
    clearSessionCookie(reply);
    return reply.send({ loggedOut: true });
  });
}

function nonceKey(walletAddress: string): string {
  return `wallet-auth:${walletAddress.toLowerCase()}`;
}

function buildWalletLoginMessage(walletAddress: string, nonce: string): string {
  return [
    "Sign in to Hood Terminal",
    "",
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Nonce: ${nonce}`,
    "This signature does not grant token approvals or move funds.",
  ].join("\n");
}
