CREATE TABLE "alert_events" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_id" text NOT NULL,
	"user_id" text NOT NULL,
	"target_address" text NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_alert_events_alert" ON "alert_events" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "idx_alert_events_user" ON "alert_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alert_events_target" ON "alert_events" USING btree ("target_address");