CREATE TYPE "public"."risk_band" AS ENUM('low', 'some_risk', 'high', 'extreme', 'rugged');--> statement-breakpoint
CREATE TYPE "public"."token_status" AS ENUM('live', 'dead', 'rugged', 'honeypot');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_address" text NOT NULL,
	"trigger_type" text NOT NULL,
	"delivery_channels" text[],
	"is_active" boolean DEFAULT true,
	"last_fired_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deployers" (
	"address" text PRIMARY KEY NOT NULL,
	"total_launches" integer DEFAULT 0,
	"confirmed_rugs" integer DEFAULT 0,
	"survival_rate_30d" real,
	"median_token_life_hours" real,
	"is_serial_rug" boolean DEFAULT false,
	"first_seen" timestamp DEFAULT now(),
	"last_launch" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "holder_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"token_address" text NOT NULL,
	"holder_count" integer,
	"top1_pct" real,
	"top10_pct" real,
	"top10_sybil_adjusted" real,
	"fresh_wallet_pct" real,
	"sybil_bands" integer,
	"snapshot_block" bigint,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lp_events" (
	"id" text PRIMARY KEY NOT NULL,
	"token_address" text NOT NULL,
	"event_type" text NOT NULL,
	"pool_address" text,
	"liquidity" real,
	"lock_until" timestamp,
	"owner" text,
	"tx_hash" text,
	"block_number" bigint,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scan_results" (
	"id" text PRIMARY KEY NOT NULL,
	"token_address" text NOT NULL,
	"score" integer NOT NULL,
	"band" "risk_band" NOT NULL,
	"confidence" text NOT NULL,
	"modules_ran" integer NOT NULL,
	"modules_total" integer DEFAULT 31,
	"module_results" jsonb NOT NULL,
	"summary" text,
	"scan_duration_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"symbol" text,
	"decimals" integer DEFAULT 18,
	"deployer" text,
	"launchpad" text,
	"deploy_block" bigint,
	"deploy_tx" text,
	"status" "token_status" DEFAULT 'live',
	"death_block" bigint,
	"peak_mcap" real,
	"current_mcap" real,
	"total_scans" integer DEFAULT 0,
	"first_scan_score" integer,
	"latest_score" integer,
	"latest_band" "risk_band",
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"address" text PRIMARY KEY NOT NULL,
	"labels" text[],
	"is_repeat_offender" boolean DEFAULT false,
	"confirmed_rugs" integer DEFAULT 0,
	"tokens_appeared_in" integer DEFAULT 0,
	"realized_pnl_30d" real,
	"win_rate_30d" real,
	"first_seen" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_alerts_target" ON "alerts" USING btree ("target_address");--> statement-breakpoint
CREATE INDEX "idx_alerts_user" ON "alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_holder_token" ON "holder_snapshots" USING btree ("token_address");--> statement-breakpoint
CREATE INDEX "idx_lp_token" ON "lp_events" USING btree ("token_address");--> statement-breakpoint
CREATE INDEX "idx_scans_token" ON "scan_results" USING btree ("token_address");--> statement-breakpoint
CREATE INDEX "idx_scans_score" ON "scan_results" USING btree ("score");--> statement-breakpoint
CREATE INDEX "idx_scans_created" ON "scan_results" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tokens_deployer" ON "tokens" USING btree ("deployer");--> statement-breakpoint
CREATE INDEX "idx_tokens_status" ON "tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tokens_latest_score" ON "tokens" USING btree ("latest_score");--> statement-breakpoint
CREATE INDEX "idx_tokens_created" ON "tokens" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_wallets_labels" ON "wallets" USING btree ("labels");--> statement-breakpoint
CREATE INDEX "idx_wallets_pnl" ON "wallets" USING btree ("realized_pnl_30d");