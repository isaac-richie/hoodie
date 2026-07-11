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
  // Which parts of the process to run: "all" (default, single-process), "api"
  // (HTTP only), or "worker" (background discovery/scan/alert workers only).
  // Lets the API and workers be scaled independently without code changes.
  ROLE: z.enum(["all", "api", "worker"]).optional().default("all"),
  // Enable Fastify per-request access logging.
  REQUEST_LOGGING: boolFromEnv,
  REQUIRE_AUTH: boolFromEnv,
  SESSION_SECRET: z.string().optional().default("dev-session-secret-change-me"),
  // Comma-separated allowlist of origins permitted to send credentialed requests.
  // Empty in dev = reflect localhost; required (non-empty) in production.
  CORS_ORIGINS: z.string().optional().default(""),
  // Set to "true" only when the app runs behind a trusted proxy/load balancer
  // that sets X-Forwarded-For. When false, Fastify ignores XFF and uses the
  // socket IP, so clients can't spoof their identity to bypass rate limits.
  TRUST_PROXY: boolFromEnv,
  SESSION_COOKIE_NAME: z.string().optional().default("hood_session"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().optional().default(60 * 60 * 24 * 7),
  COOKIE_SECURE: optionalBoolFromEnv,
  SCAN_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(10000),
  SCAN_CONCURRENCY: z.coerce.number().int().positive().optional().default(31),
  // Max scans running inline on the HTTP layer at once (separate from the
  // background worker's SCAN_CONCURRENCY). Bounds RPC/DB fan-out under load.
  API_SCAN_CONCURRENCY: z.coerce.number().int().positive().optional().default(8),
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

const DEFAULT_SESSION_SECRET = "dev-session-secret-change-me";

// Production hardening: refuse to boot with insecure defaults that would allow
// anyone reading the public repo to forge sessions or let any origin call the API.
if (values.NODE_ENV === "production") {
  const problems: string[] = [];
  if (!values.SESSION_SECRET || values.SESSION_SECRET === DEFAULT_SESSION_SECRET) {
    problems.push(
      "SESSION_SECRET must be set to a strong, secret value in production (the default placeholder is committed to the repo and would let anyone forge sessions)"
    );
  }
  if (values.SESSION_SECRET && values.SESSION_SECRET.length < 32) {
    problems.push("SESSION_SECRET must be at least 32 characters in production");
  }
  if (!values.CORS_ORIGINS.trim()) {
    problems.push(
      "CORS_ORIGINS must list the exact allowed frontend origin(s) in production (an open CORS policy with credentials lets any website act as a logged-in user)"
    );
  }
  if (problems.length > 0) {
    throw new Error(`Refusing to start in production:\n- ${problems.join("\n- ")}`);
  }
}

const corsOrigins = values.CORS_ORIGINS
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  rpcUrl: values.RPC_URL,
  rpcWss: values.RPC_WSS,
  databaseUrl: values.DATABASE_URL,
  databaseSslRejectUnauthorized: values.DATABASE_SSL_REJECT_UNAUTHORIZED,
  redisUrl: values.REDIS_URL,
  port: values.PORT,
  host: values.HOST,
  nodeEnv: values.NODE_ENV,
  role: values.ROLE,
  requestLogging: values.REQUEST_LOGGING,
  requireAuth: values.REQUIRE_AUTH,
  sessionSecret: values.SESSION_SECRET,
  corsOrigins,
  trustProxy: values.TRUST_PROXY,
  sessionCookieName: values.SESSION_COOKIE_NAME,
  sessionTtlSeconds: values.SESSION_TTL_SECONDS,
  cookieSecure: values.COOKIE_SECURE ?? values.NODE_ENV === "production",
  scanTimeoutMs: values.SCAN_TIMEOUT_MS,
  scanConcurrency: values.SCAN_CONCURRENCY,
  apiScanConcurrency: values.API_SCAN_CONCURRENCY,
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
