TRUNCATE TABLE "revoked_refresh_tokens";--> statement-breakpoint
ALTER TABLE "revoked_refresh_tokens" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "revoked_refresh_tokens" ADD CONSTRAINT "revoked_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "revoked_refresh_tokens_user_id_idx" ON "revoked_refresh_tokens" USING btree ("user_id");