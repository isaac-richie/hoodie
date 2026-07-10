CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Default key',
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scopes" text[],
	"tier" text DEFAULT 'free',
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_address" text,
	"email" text,
	"display_name" text,
	"tier" text DEFAULT 'free',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_address" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "threshold" integer;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_api_keys_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_wallet" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_watchlist_user" ON "watchlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_watchlist_token" ON "watchlist_items" USING btree ("token_address");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_watchlist_user_token" ON "watchlist_items" USING btree ("user_id","token_address");