CREATE TABLE "invoice_sequences" (
	"organization_id" integer PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_quantity_budget_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quantity_budget_id" integer NOT NULL,
	"budget_id" integer,
	"organization_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"organization_inventory_id" integer NOT NULL,
	"global_product_id" integer NOT NULL,
	"period" varchar(16) NOT NULL,
	"allocation_type" varchar(32) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"price_cents" bigint NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_by_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_quantity_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"organization_inventory_id" integer NOT NULL,
	"global_product_id" integer NOT NULL,
	"period" varchar(16) NOT NULL,
	"allocated_quantity" numeric(12, 3) DEFAULT 0 NOT NULL,
	"held_quantity" numeric(12, 3) DEFAULT 0 NOT NULL,
	"used_quantity" numeric(12, 3) DEFAULT 0 NOT NULL,
	"credited_quantity" numeric(12, 3) DEFAULT 0 NOT NULL,
	"amount_allocated_cents" bigint DEFAULT 0 NOT NULL,
	"amount_credited_cents" bigint DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "global_products" ALTER COLUMN "stock_quantity" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "refund_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "restock_requests" ALTER COLUMN "requested_quantity" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "restock_requests" ALTER COLUMN "current_stock" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "province" varchar(100);--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "global_products" ADD COLUMN "allow_decimal_quantity" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "global_products" ADD COLUMN "quantity_step" numeric(12, 3) DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "organization_inventory_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_status" varchar(32) DEFAULT 'NOT_STARTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "refund_number" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budget_allocations" ADD CONSTRAINT "product_quantity_budget_allocations_quantity_budget_id_product_quantity_budgets_id_fk" FOREIGN KEY ("quantity_budget_id") REFERENCES "public"."product_quantity_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budget_allocations" ADD CONSTRAINT "product_quantity_budget_allocations_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budget_allocations" ADD CONSTRAINT "product_quantity_budget_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budget_allocations" ADD CONSTRAINT "product_quantity_budget_allocations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budget_allocations" ADD CONSTRAINT "product_quantity_budget_allocations_organization_inventory_id_organization_inventory_id_fk" FOREIGN KEY ("organization_inventory_id") REFERENCES "public"."organization_inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budget_allocations" ADD CONSTRAINT "product_quantity_budget_allocations_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budget_allocations" ADD CONSTRAINT "product_quantity_budget_allocations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budgets" ADD CONSTRAINT "product_quantity_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budgets" ADD CONSTRAINT "product_quantity_budgets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budgets" ADD CONSTRAINT "product_quantity_budgets_organization_inventory_id_organization_inventory_id_fk" FOREIGN KEY ("organization_inventory_id") REFERENCES "public"."organization_inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budgets" ADD CONSTRAINT "product_quantity_budgets_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budgets" ADD CONSTRAINT "product_quantity_budgets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_quantity_budgets" ADD CONSTRAINT "product_quantity_budgets_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_quantity_budget_allocations_budget_idx" ON "product_quantity_budget_allocations" USING btree ("quantity_budget_id");--> statement-breakpoint
CREATE INDEX "product_quantity_budget_allocations_branch_idx" ON "product_quantity_budget_allocations" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "product_quantity_budget_allocations_product_idx" ON "product_quantity_budget_allocations" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "product_quantity_budget_allocations_period_idx" ON "product_quantity_budget_allocations" USING btree ("period");--> statement-breakpoint
CREATE UNIQUE INDEX "product_quantity_budgets_branch_product_period_uq" ON "product_quantity_budgets" USING btree ("branch_id","organization_inventory_id","period");--> statement-breakpoint
CREATE INDEX "product_quantity_budgets_org_idx" ON "product_quantity_budgets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_quantity_budgets_branch_idx" ON "product_quantity_budgets" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "product_quantity_budgets_product_idx" ON "product_quantity_budgets" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "product_quantity_budgets_period_idx" ON "product_quantity_budgets" USING btree ("period");--> statement-breakpoint
CREATE INDEX "order_items_organization_inventory_idx" ON "order_items" USING btree ("organization_inventory_id");--> statement-breakpoint
CREATE INDEX "orders_fulfillment_status_idx" ON "orders" USING btree ("fulfillment_status");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_refund_number_unique" UNIQUE("refund_number");