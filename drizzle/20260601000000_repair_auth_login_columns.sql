ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar(255);--> statement-breakpoint
ALTER TABLE "employee_credentials" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_credentials" ADD COLUMN IF NOT EXISTS "username" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username") WHERE "username" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employee_creds_username_uq" ON "employee_credentials" USING btree ("username") WHERE "username" IS NOT NULL;
