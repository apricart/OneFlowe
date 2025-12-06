DROP INDEX IF EXISTS "users_login_code_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "login_code";