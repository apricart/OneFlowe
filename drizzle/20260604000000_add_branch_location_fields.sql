ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "province" varchar(100);--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "city" varchar(100);--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "address" text;
