/**
 * Redis Client & Cache Key Registry
 *
 * Single Redis instance used for: caching (RPC data, scan results, token meta),
 * job queues (BullMQ), API key storage, and discovery worker state.
 *
 * lazyConnect: true — we call redis.connect() explicitly in index.ts so startup
 * fails fast if Redis is down instead of silently queuing commands.
 *
 * CACHE_KEYS: centralized key patterns. All cache keys should be defined here
 * to avoid collisions and make it easy to grep for what's stored.
 */
import Redis from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

export const CACHE_KEYS = {
  scanResult: (address: string) => `scan:${address.toLowerCase()}`,
  tokenMeta: (address: string) => `meta:${address.toLowerCase()}`,
  deployerRep: (address: string) => `deployer:${address.toLowerCase()}`,
  walletRap: (address: string) => `rap:${address.toLowerCase()}`,
  rateLimit: (key: string) => `rl:${key}`,
  session: (id: string) => `session:${id}`,
} as const;
