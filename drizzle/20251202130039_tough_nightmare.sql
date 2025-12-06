ALTER TABLE "warehouses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "warehouses" CASCADE;--> statement-breakpoint
DROP INDEX "branch_products_low_stock_idx";--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "processed_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "global_products" ADD COLUMN IF NOT EXISTS "discount_type" varchar(16);--> statement-breakpoint
ALTER TABLE "global_products" ADD COLUMN IF NOT EXISTS "discount_value_cents" integer;--> statement-breakpoint
ALTER TABLE "global_products" ADD COLUMN IF NOT EXISTS "discount_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "global_products" ADD COLUMN IF NOT EXISTS "discount_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "global_products" ADD COLUMN IF NOT EXISTS "discount_active" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "global_products" ADD COLUMN IF NOT EXISTS "stock_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "status" varchar(16) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "requested_by_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "branch_inventory" DROP COLUMN "stock_quantity";--> statement-breakpoint
ALTER TABLE "branch_inventory" DROP COLUMN "reorder_threshold";--> statement-breakpoint
ALTER TABLE "branch_products" DROP COLUMN "stock_quantity";--> statement-breakpoint
ALTER TABLE "branch_products" DROP COLUMN "reserved_quantity";--> statement-breakpoint
ALTER TABLE "branch_products" DROP COLUMN "reorder_threshold";--> statement-breakpoint
ALTER TABLE "branch_products" DROP COLUMN "reorder_quantity";--> statement-breakpoint
ALTER TABLE "branch_products" DROP COLUMN "last_restock_date";--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "quantity";--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "reserved_quantity";--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "reorder_threshold";