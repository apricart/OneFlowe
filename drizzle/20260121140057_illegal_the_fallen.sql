CREATE TABLE "group_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"global_product_id" integer NOT NULL,
	"organization_product_id" integer,
	"is_visible" boolean DEFAULT true NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"custom_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(32) DEFAULT 'active',
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "approval_token" varchar(16);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "approval_token_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "approval_token_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfilled_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "group_products" ADD CONSTRAINT "group_products_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_products" ADD CONSTRAINT "group_products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_products" ADD CONSTRAINT "group_products_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_products" ADD CONSTRAINT "group_products_organization_product_id_organization_products_id_fk" FOREIGN KEY ("organization_product_id") REFERENCES "public"."organization_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_products" ADD CONSTRAINT "group_products_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_products_group_product_uq" ON "group_products" USING btree ("group_id","global_product_id");--> statement-breakpoint
CREATE INDEX "group_products_group_idx" ON "group_products" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_products_org_idx" ON "group_products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "group_products_global_idx" ON "group_products" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "group_products_org_product_idx" ON "group_products" USING btree ("organization_product_id");--> statement-breakpoint
CREATE INDEX "group_products_visible_idx" ON "group_products" USING btree ("is_visible");--> statement-breakpoint
CREATE INDEX "group_products_available_idx" ON "group_products" USING btree ("is_available");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_org_name_uq" ON "groups" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "groups_org_idx" ON "groups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "groups_status_idx" ON "groups" USING btree ("status");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfilled_by_user_id_users_id_fk" FOREIGN KEY ("fulfilled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_group_idx" ON "branches" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "budgets_group_idx" ON "budgets" USING btree ("group_id");