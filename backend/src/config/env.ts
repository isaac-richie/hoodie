/**
 * Environment Configuration
 *
 * All env vars are read once at startup and exposed as a typed object.
 * Add new vars here — never read process.env directly in other files.
 *
 * Required vars (will crash on boot if missing): RPC_URL, DATABASE_URL
 * Optional vars have sensible defaults for local development.
 */
import { config } from "dotenv";
import { z } from "zod";
config();

const boolFromEnv = z
  .string()
  .optional()
  .transform((value) => value === "true");

const optionalBoolFromEnv = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value === "true";
  });

const envSchema = z.object({
  RPC_URL: z.string().min(1, "RPC_URL is required"),
  RPC_WSS: z.string().optional().default(""),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SSL_REJECT_UNAUTHORIZED: optionalBoolFromEnv,
  REDIS_URL: z.string().optional().default("redis://localhost:6379"),
  PORT: z.coerce.number().int().positive().optional().default(3001),
  HOST: z.string().optional().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  REQUIRE_AUTH: boolFromEnv,
  SESSION_SECRET: z.string().optional().default("dev-session-secret-change-me"),
  SESSION_COOKIE_NAME: z.string().optional().default("hood_session"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().optional().default(60 * 60 * 24 * 7),
  COOKIE_SECURE: optionalBoolFromEnv,
  SCAN_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(10000),
  SCAN_CONCURRENCY: z.coerce.number().int().positive().optional().default(31),
  CACHE_SCAN_TTL_S: z.coerce.number().int().positive().optional().default(300),
  EXPLORER_API_URL: z.string().optional().default(""),
  EXPLORER_API_KEY: z.string().optional().default(""),
  WETH_ADDRESS: z.string().optional().default(""),
  DEX_ROUTER_ADDRESS: z.string().optional().default(""),
  DEX_ROUTERS: z.string().optional().default(""),
  DEX_FACTORY_ADDRESS: z.string().optional().default(""),
  DEX_FACTORIES: z.string().optional().default(""),
  LP_LOCKER_ADDRESSES: z.string().optional().default(""),
  LAUNCHPAD_CONTRACTS: z.string().optional().default(""),
  CHAIN_ID: z.coerce.number().int().positive().optional().default(4663),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid backend environment: ${details}`);
}

const values = parsedEnv.data;

export const env = {
  rpcUrl: values.RPC_URL,
  rpcWss: values.RPC_WSS,
  databaseUrl: values.DATABASE_URL,
  databaseSslRejectUnauthorized: values.DATABASE_SSL_REJECT_UNAUTHORIZED,
  redisUrl: values.REDIS_URL,
  port: values.PORT,
  host: values.HOST,
  nodeEnv: values.NODE_ENV,
  requireAuth: values.REQUIRE_AUTH,
  sessionSecret: values.SESSION_SECRET,
  sessionCookieName: values.SESSION_COOKIE_NAME,
  sessionTtlSeconds: values.SESSION_TTL_SECONDS,
  cookieSecure: values.COOKIE_SECURE ?? values.NODE_ENV === "production",
  scanTimeoutMs: values.SCAN_TIMEOUT_MS,
  scanConcurrency: values.SCAN_CONCURRENCY,
  cacheScanTtlS: values.CACHE_SCAN_TTL_S,
  explorerApiUrl: values.EXPLORER_API_URL,
  explorerApiKey: values.EXPLORER_API_KEY,
  wethAddress: values.WETH_ADDRESS,
  dexRouterAddress: values.DEX_ROUTER_ADDRESS,
  dexRouters: values.DEX_ROUTERS,
  dexFactoryAddress: values.DEX_FACTORY_ADDRESS,
  dexFactories: values.DEX_FACTORIES,
  lpLockerAddresses: values.LP_LOCKER_ADDRESSES,
  launchpadContracts: values.LAUNCHPAD_CONTRACTS,
  chainId: values.CHAIN_ID,
} as const;
