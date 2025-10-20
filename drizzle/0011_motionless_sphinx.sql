CREATE TABLE "branch_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"organization_inventory_id" integer NOT NULL,
	"global_product_id" integer NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"reorder_threshold" integer DEFAULT 10 NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"global_product_id" integer NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"custom_name" varchar(255),
	"custom_price_cents" integer,
	"custom_description" text,
	"custom_image_url" varchar(512),
	"assigned_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "branch_inventory" ADD CONSTRAINT "branch_inventory_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_inventory" ADD CONSTRAINT "branch_inventory_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_inventory" ADD CONSTRAINT "branch_inventory_organization_inventory_id_organization_inventory_id_fk" FOREIGN KEY ("organization_inventory_id") REFERENCES "public"."organization_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_inventory" ADD CONSTRAINT "branch_inventory_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_inventory" ADD CONSTRAINT "branch_inventory_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_inventory" ADD CONSTRAINT "organization_inventory_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_inventory" ADD CONSTRAINT "organization_inventory_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_inventory" ADD CONSTRAINT "organization_inventory_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_inventory_branch_org_inventory_uq" ON "branch_inventory" USING btree ("branch_id","organization_inventory_id");--> statement-breakpoint
CREATE INDEX "branch_inventory_branch_idx" ON "branch_inventory" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_inventory_org_idx" ON "branch_inventory" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "branch_inventory_org_inventory_idx" ON "branch_inventory" USING btree ("organization_inventory_id");--> statement-breakpoint
CREATE INDEX "branch_inventory_global_product_idx" ON "branch_inventory" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "branch_inventory_assigned_by_idx" ON "branch_inventory" USING btree ("assigned_by_user_id");--> statement-breakpoint
CREATE INDEX "branch_inventory_visible_idx" ON "branch_inventory" USING btree ("is_visible");--> statement-breakpoint
CREATE INDEX "branch_inventory_active_idx" ON "branch_inventory" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "org_inventory_org_product_uq" ON "organization_inventory" USING btree ("organization_id","global_product_id");--> statement-breakpoint
CREATE INDEX "org_inventory_org_idx" ON "organization_inventory" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_inventory_global_product_idx" ON "organization_inventory" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "org_inventory_assigned_by_idx" ON "organization_inventory" USING btree ("assigned_by_user_id");--> statement-breakpoint
CREATE INDEX "org_inventory_active_idx" ON "organization_inventory" USING btree ("is_active");