ALTER TABLE "users" ALTER COLUMN "imprest_holder" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "imprest_holder" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "imprest_holder" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_credentials" ADD COLUMN IF NOT EXISTS "username" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employee_creds_username_uq" ON "employee_credentials" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");
