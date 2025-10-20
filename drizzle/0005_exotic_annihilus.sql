ALTER TABLE "inventory" DROP CONSTRAINT "inventory_organization_product_id_organization_products_id_fk";
--> statement-breakpoint
ALTER TABLE "restock_requests" DROP CONSTRAINT "restock_requests_requested_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "restock_requests" DROP CONSTRAINT "restock_requests_approved_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "inventory_org_product_idx";--> statement-breakpoint
DROP INDEX "org_products_org_product_uq";--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "default_reorder_threshold" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "sync_with_global" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "assigned_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "assigned_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_url" varchar(512);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "organization_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "current_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "priority" varchar(32) DEFAULT 'NORMAL';--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "requested_by_user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "fulfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_product_uq" ON "organization_products" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "org_products_active_idx" ON "organization_products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "products_global_idx" ON "products" USING btree ("is_global");--> statement-breakpoint
CREATE INDEX "restock_requests_org_idx" ON "restock_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "restock_requests_priority_idx" ON "restock_requests" USING btree ("priority");--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "organization_product_id";--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "discount";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "auto_sync";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "requested_by";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "approved_by";