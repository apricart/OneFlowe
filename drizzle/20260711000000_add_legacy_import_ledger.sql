CREATE TABLE "legacy_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" integer NOT NULL,
	"source_system" varchar(64) NOT NULL,
	"source_manifest" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'RUNNING' NOT NULL,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"imported_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "legacy_product_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"source_system" varchar(64) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"source_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"global_product_id" integer NOT NULL,
	"organization_inventory_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_order_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"organization_id" integer NOT NULL,
	"source_system" varchar(64) NOT NULL,
	"legacy_order_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"source_checksum" varchar(64) NOT NULL,
	"source_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_user_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"source_system" varchar(64) NOT NULL,
	"legacy_order_taker_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_by_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legacy_import_batches" ADD CONSTRAINT "legacy_import_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_import_batches" ADD CONSTRAINT "legacy_import_batches_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_product_mappings" ADD CONSTRAINT "legacy_product_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_product_mappings" ADD CONSTRAINT "legacy_product_mappings_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_product_mappings" ADD CONSTRAINT "legacy_product_mappings_organization_inventory_id_organization_inventory_id_fk" FOREIGN KEY ("organization_inventory_id") REFERENCES "public"."organization_inventory"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_user_mappings" ADD CONSTRAINT "legacy_user_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_user_mappings" ADD CONSTRAINT "legacy_user_mappings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_user_mappings" ADD CONSTRAINT "legacy_user_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_user_mappings" ADD CONSTRAINT "legacy_user_mappings_created_by_batch_id_legacy_import_batches_id_fk" FOREIGN KEY ("created_by_batch_id") REFERENCES "public"."legacy_import_batches"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_order_imports" ADD CONSTRAINT "legacy_order_imports_batch_id_legacy_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."legacy_import_batches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_order_imports" ADD CONSTRAINT "legacy_order_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_order_imports" ADD CONSTRAINT "legacy_order_imports_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "legacy_import_batches_org_idx" ON "legacy_import_batches" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "legacy_import_batches_source_status_idx" ON "legacy_import_batches" USING btree ("source_system", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_product_mappings_source_product_uq" ON "legacy_product_mappings" USING btree ("organization_id", "source_system", "normalized_name");
--> statement-breakpoint
CREATE INDEX "legacy_product_mappings_product_idx" ON "legacy_product_mappings" USING btree ("global_product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_user_mappings_source_user_uq" ON "legacy_user_mappings" USING btree ("organization_id", "source_system", "legacy_order_taker_id", "branch_id");
--> statement-breakpoint
CREATE INDEX "legacy_user_mappings_user_idx" ON "legacy_user_mappings" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "legacy_user_mappings_batch_idx" ON "legacy_user_mappings" USING btree ("created_by_batch_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_order_imports_source_order_uq" ON "legacy_order_imports" USING btree ("organization_id", "source_system", "legacy_order_id");
--> statement-breakpoint
CREATE INDEX "legacy_order_imports_batch_idx" ON "legacy_order_imports" USING btree ("batch_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_order_imports_order_idx" ON "legacy_order_imports" USING btree ("order_id");
--> statement-breakpoint
ALTER TABLE "legacy_import_batches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "legacy_product_mappings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "legacy_user_mappings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "legacy_order_imports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "legacy_import_batches", "legacy_product_mappings", "legacy_user_mappings", "legacy_order_imports" FROM anon;
    REVOKE ALL ON SEQUENCE "legacy_product_mappings_id_seq", "legacy_user_mappings_id_seq", "legacy_order_imports_id_seq" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "legacy_import_batches", "legacy_product_mappings", "legacy_user_mappings", "legacy_order_imports" FROM authenticated;
    REVOKE ALL ON SEQUENCE "legacy_product_mappings_id_seq", "legacy_user_mappings_id_seq", "legacy_order_imports_id_seq" FROM authenticated;
  END IF;
END $$;
