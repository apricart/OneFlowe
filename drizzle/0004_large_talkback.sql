CREATE TABLE "organization_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"sku_id" integer NOT NULL,
	"custom_name" varchar(255),
	"custom_description" text,
	"custom_price_cents" integer,
	"discount" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"auto_sync" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restock_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"sku_id" integer NOT NULL,
	"requested_quantity" integer NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "organization_product_id" integer;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_products" ADD CONSTRAINT "organization_products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_products" ADD CONSTRAINT "organization_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_products" ADD CONSTRAINT "organization_products_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_products_org_product_uq" ON "organization_products" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "org_products_org_idx" ON "organization_products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_products_product_idx" ON "organization_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "restock_requests_branch_idx" ON "restock_requests" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "restock_requests_status_idx" ON "restock_requests" USING btree ("status");--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_organization_product_id_organization_products_id_fk" FOREIGN KEY ("organization_product_id") REFERENCES "public"."organization_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_org_product_idx" ON "inventory" USING btree ("organization_product_id");