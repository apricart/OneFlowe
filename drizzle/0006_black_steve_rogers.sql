CREATE TABLE "branch_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"global_product_id" integer NOT NULL,
	"organization_product_id" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"reorder_threshold" integer DEFAULT 10 NOT NULL,
	"reorder_quantity" integer DEFAULT 50 NOT NULL,
	"last_restock_date" timestamp with time zone,
	"custom_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "global_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_code" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category_id" integer,
	"image_url" varchar(512),
	"base_price_cents" integer DEFAULT 0 NOT NULL,
	"unit" varchar(64) DEFAULT 'unit' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_type" varchar(64) NOT NULL,
	"trigger_level" varchar(32) NOT NULL,
	"target_type" varchar(32) NOT NULL,
	"target_id" integer,
	"affected_products" jsonb DEFAULT '[]'::jsonb,
	"changes_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"performed_by_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "product_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"global_product_id" integer NOT NULL,
	"assigned_to_type" varchar(32) NOT NULL,
	"assigned_to_id" integer NOT NULL,
	"action" varchar(32) NOT NULL,
	"performed_by_user_id" uuid NOT NULL,
	"performed_by_role" varchar(64) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"successful_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'processing' NOT NULL,
	"validation_errors" jsonb DEFAULT '[]'::jsonb,
	"imported_product_ids" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "organization_products" DROP CONSTRAINT "organization_products_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_products" DROP CONSTRAINT "organization_products_sku_id_skus_id_fk";
--> statement-breakpoint
ALTER TABLE "restock_requests" DROP CONSTRAINT "restock_requests_sku_id_skus_id_fk";
--> statement-breakpoint
DROP INDEX "org_product_uq";--> statement-breakpoint
DROP INDEX "org_products_product_idx";--> statement-breakpoint
DROP INDEX "org_products_active_idx";--> statement-breakpoint
DROP INDEX "products_global_idx";--> statement-breakpoint
DROP INDEX "restock_requests_priority_idx";--> statement-breakpoint
ALTER TABLE "restock_requests" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "global_product_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "is_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "custom_image_url" varchar(512);--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "priority" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "override_source" varchar(32) DEFAULT 'head_office';--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "updated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "global_product_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "current_stock" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_organization_product_id_organization_products_id_fk" FOREIGN KEY ("organization_product_id") REFERENCES "public"."organization_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_products" ADD CONSTRAINT "global_products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_products" ADD CONSTRAINT "global_products_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_sync_logs" ADD CONSTRAINT "inventory_sync_logs_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assignments" ADD CONSTRAINT "product_assignments_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assignments" ADD CONSTRAINT "product_assignments_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_import_batches" ADD CONSTRAINT "product_import_batches_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_products_branch_product_uq" ON "branch_products" USING btree ("branch_id","global_product_id");--> statement-breakpoint
CREATE INDEX "branch_products_branch_idx" ON "branch_products" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_products_org_idx" ON "branch_products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "branch_products_global_idx" ON "branch_products" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "branch_products_org_product_idx" ON "branch_products" USING btree ("organization_product_id");--> statement-breakpoint
CREATE INDEX "branch_products_available_idx" ON "branch_products" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "branch_products_low_stock_idx" ON "branch_products" USING btree ("stock_quantity");--> statement-breakpoint
CREATE UNIQUE INDEX "global_products_code_idx" ON "global_products" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "global_products_name_idx" ON "global_products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "global_products_category_idx" ON "global_products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "global_products_status_idx" ON "global_products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_sync_logs_type_idx" ON "inventory_sync_logs" USING btree ("sync_type");--> statement-breakpoint
CREATE INDEX "inventory_sync_logs_target_idx" ON "inventory_sync_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "inventory_sync_logs_status_idx" ON "inventory_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_sync_logs_user_idx" ON "inventory_sync_logs" USING btree ("performed_by_user_id");--> statement-breakpoint
CREATE INDEX "inventory_sync_logs_started_at_idx" ON "inventory_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "product_assignments_product_idx" ON "product_assignments" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "product_assignments_assigned_to_idx" ON "product_assignments" USING btree ("assigned_to_type","assigned_to_id");--> statement-breakpoint
CREATE INDEX "product_assignments_user_idx" ON "product_assignments" USING btree ("performed_by_user_id");--> statement-breakpoint
CREATE INDEX "product_import_batches_user_idx" ON "product_import_batches" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "product_import_batches_status_idx" ON "product_import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_import_batches_created_at_idx" ON "product_import_batches" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "organization_products" ADD CONSTRAINT "organization_products_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_products" ADD CONSTRAINT "organization_products_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_products_org_product_uq" ON "organization_products" USING btree ("organization_id","global_product_id");--> statement-breakpoint
CREATE INDEX "org_products_global_idx" ON "organization_products" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "org_products_enabled_idx" ON "organization_products" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "restock_requests_product_idx" ON "restock_requests" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "restock_requests_requested_by_idx" ON "restock_requests" USING btree ("requested_by_user_id");--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "product_id";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "sku_id";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "default_reorder_threshold";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "sync_with_global";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "assigned_at";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "assigned_by_user_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "is_global";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "created_by_user_id";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "sku_id";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "current_quantity";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "priority";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "approved_by_user_id";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "approved_at";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "fulfilled_at";--> statement-breakpoint
ALTER TABLE "restock_requests" DROP COLUMN "notes";