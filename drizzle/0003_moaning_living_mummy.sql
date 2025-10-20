CREATE TABLE "head_offices" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"month" varchar(16),
	"total_orders" integer,
	"total_spend_cents" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"key" varchar(128) NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_key" varchar(128) NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "reserved_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "target_role" varchar(64);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "status" varchar(32) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agent" varchar(255);--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "head_offices" ADD CONSTRAINT "head_offices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_metrics" ADD CONSTRAINT "org_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "head_offices_org_idx" ON "head_offices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_metrics_org_idx" ON "org_metrics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_settings_org_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_branch_idx" ON "audit_logs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "categories_org_idx" ON "categories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inventory_org_idx" ON "inventory" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inventory_org_branch_sku_idx" ON "inventory" USING btree ("organization_id","branch_id","sku_id");--> statement-breakpoint
CREATE INDEX "notifications_org_idx" ON "notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notifications_branch_idx" ON "notifications" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "order_items_org_idx" ON "order_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "orders_org_idx" ON "orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "orders_org_branch_status_idx" ON "orders" USING btree ("organization_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "org_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_org_idx" ON "products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sessions_org_idx" ON "sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skus_org_idx" ON "skus" USING btree ("organization_id");