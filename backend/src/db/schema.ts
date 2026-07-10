/**
 * Database Schema — PostgreSQL tables defined with Drizzle ORM.
 *
 * Tables:
 *   tokens           — every token we've seen, with latest scan score
 *   deployers        — wallet-level reputation (launch count, rug count, survival rate)
 *   scan_results     — full audit trail of every scan (one row per scan)
 *   wallets          — known wallet labels and reputation (sniper, bundler, etc.)
 *   holder_snapshots — point-in-time holder distribution snapshots
 *   lp_events        — LP add/remove/lock/burn events
 *   alerts           — user-configured notifications (score change, new token, etc.)
 *
 * To generate migrations: npm run db:generate
 * To push schema directly (dev): npm run db:push
 * To run migrations: npm run migrate
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  bigint,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

export const riskBandEnum = pgEnum("risk_band", [
  "low",
  "some_risk",
  "high",
  "extreme",
  "rugged",
]);

export const tokenStatusEnum = pgEnum("token_status", [
  "live",
  "dead",
  "rugged",
  "honeypot",
]);

// ─── Users / Product State ────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    walletAddress: text("wallet_address"),
    email: text("email"),
    displayName: text("display_name"),
    tier: text("tier").default("free"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    walletIdx: uniqueIndex("idx_users_wallet").on(t.walletAddress),
    emailIdx: uniqueIndex("idx_users_email").on(t.email),
  })
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").default("Default key"),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    scopes: text("scopes").array(),
    tier: text("tier").default("free"),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_api_keys_user").on(t.userId),
    hashIdx: uniqueIndex("idx_api_keys_hash").on(t.keyHash),
  })
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_watchlist_user").on(t.userId),
    tokenIdx: index("idx_watchlist_token").on(t.tokenAddress),
    userTokenIdx: uniqueIndex("idx_watchlist_user_token").on(t.userId, t.tokenAddress),
  })
);

// ─── Tokens ───────────────────────────────────────────────────────────────────

export const tokens = pgTable(
  "tokens",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    symbol: text("symbol"),
    decimals: integer("decimals").default(18),
    deployer: text("deployer"),
    launchpad: text("launchpad"),
    deployBlock: bigint("deploy_block", { mode: "number" }),
    deployTx: text("deploy_tx"),
    status: tokenStatusEnum("status").default("live"),
    deathBlock: bigint("death_block", { mode: "number" }),
    peakMcap: real("peak_mcap"),
    currentMcap: real("current_mcap"),
    totalScans: integer("total_scans").default(0),
    firstScanScore: integer("first_scan_score"),
    latestScore: integer("latest_score"),
    latestBand: riskBandEnum("latest_band"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    deployerIdx: index("idx_tokens_deployer").on(t.deployer),
    statusIdx: index("idx_tokens_status").on(t.status),
    scoreIdx: index("idx_tokens_latest_score").on(t.latestScore),
    createdIdx: index("idx_tokens_created").on(t.createdAt),
  })
);

// ─── Deployers ────────────────────────────────────────────────────────────────

export const deployers = pgTable("deployers", {
  address: text("address").primaryKey(),
  totalLaunches: integer("total_launches").default(0),
  confirmedRugs: integer("confirmed_rugs").default(0),
  survivalRate30d: real("survival_rate_30d"),
  medianTokenLife: real("median_token_life_hours"),
  isSerialRug: boolean("is_serial_rug").default(false),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastLaunch: timestamp("last_launch"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Scan Results ─────────────────────────────────────────────────────────────

export const scanResults = pgTable(
  "scan_results",
  {
    id: text("id").primaryKey(),
    tokenAddress: text("token_address").notNull(),
    score: integer("score").notNull(),
    band: riskBandEnum("band").notNull(),
    confidence: text("confidence").notNull(),
    modulesRan: integer("modules_ran").notNull(),
    modulesTotal: integer("modules_total").default(31),
    moduleResults: jsonb("module_results").notNull(),
    summary: text("summary"),
    scanDurationMs: integer("scan_duration_ms"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    tokenIdx: index("idx_scans_token").on(t.tokenAddress),
    scoreIdx: index("idx_scans_score").on(t.score),
    createdIdx: index("idx_scans_created").on(t.createdAt),
  })
);

// ─── Wallets ──────────────────────────────────────────────────────────────────

export const wallets = pgTable(
  "wallets",
  {
    address: text("address").primaryKey(),
    labels: text("labels").array(),
    isRepeatOffender: boolean("is_repeat_offender").default(false),
    confirmedRugs: integer("confirmed_rugs").default(0),
    tokensAppearedIn: integer("tokens_appeared_in").default(0),
    realizedPnl30d: real("realized_pnl_30d"),
    winRate30d: real("win_rate_30d"),
    firstSeen: timestamp("first_seen").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    labelsIdx: index("idx_wallets_labels").on(t.labels),
    pnlIdx: index("idx_wallets_pnl").on(t.realizedPnl30d),
  })
);

// ─── Holder Snapshots ─────────────────────────────────────────────────────────

export const holderSnapshots = pgTable(
  "holder_snapshots",
  {
    id: text("id").primaryKey(),
    tokenAddress: text("token_address").notNull(),
    holderCount: integer("holder_count"),
    top1Pct: real("top1_pct"),
    top10Pct: real("top10_pct"),
    top10SybilAdjusted: real("top10_sybil_adjusted"),
    freshWalletPct: real("fresh_wallet_pct"),
    sybilBands: integer("sybil_bands"),
    snapshotBlock: bigint("snapshot_block", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    tokenIdx: index("idx_holder_token").on(t.tokenAddress),
  })
);

// ─── LP Events ────────────────────────────────────────────────────────────────

export const lpEvents = pgTable(
  "lp_events",
  {
    id: text("id").primaryKey(),
    tokenAddress: text("token_address").notNull(),
    eventType: text("event_type").notNull(),
    poolAddress: text("pool_address"),
    liquidity: real("liquidity"),
    lockUntil: timestamp("lock_until"),
    owner: text("owner"),
    txHash: text("tx_hash"),
    blockNumber: bigint("block_number", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    tokenIdx: index("idx_lp_token").on(t.tokenAddress),
  })
);

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alerts = pgTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    targetAddress: text("target_address").notNull(),
    triggerType: text("trigger_type").notNull(),
    threshold: integer("threshold"),
    deliveryChannels: text("delivery_channels").array(),
    webhookUrl: text("webhook_url"),
    isActive: boolean("is_active").default(true),
    lastFiredAt: timestamp("last_fired_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    targetIdx: index("idx_alerts_target").on(t.targetAddress),
    userIdx: index("idx_alerts_user").on(t.userId),
  })
);

export const alertEvents = pgTable(
  "alert_events",
  {
    id: text("id").primaryKey(),
    alertId: text("alert_id").notNull(),
    userId: text("user_id").notNull(),
    targetAddress: text("target_address").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull(),
    payload: jsonb("payload"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    alertIdx: index("idx_alert_events_alert").on(t.alertId),
    userIdx: index("idx_alert_events_user").on(t.userId),
    targetIdx: index("idx_alert_events_target").on(t.targetAddress),
  })
);
