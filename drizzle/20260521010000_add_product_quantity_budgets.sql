CREATE TABLE IF NOT EXISTS "product_quantity_budgets" (
  "id" serial PRIMARY KEY,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
  "branch_id" integer NOT NULL REFERENCES "branches"("id"),
  "organization_inventory_id" integer NOT NULL REFERENCES "organization_inventory"("id") ON DELETE CASCADE,
  "global_product_id" integer NOT NULL REFERENCES "global_products"("id"),
  "period" varchar(16) NOT NULL,
  "allocated_quantity" integer NOT NULL DEFAULT 0,
  "held_quantity" integer NOT NULL DEFAULT 0,
  "used_quantity" integer NOT NULL DEFAULT 0,
  "credited_quantity" integer NOT NULL DEFAULT 0,
  "amount_allocated_cents" bigint NOT NULL DEFAULT 0,
  "amount_credited_cents" bigint NOT NULL DEFAULT 0,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "updated_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_quantity_budgets_branch_product_period_uq"
  ON "product_quantity_budgets" ("branch_id", "organization_inventory_id", "period");
CREATE INDEX IF NOT EXISTS "product_quantity_budgets_org_idx" ON "product_quantity_budgets" ("organization_id");
CREATE INDEX IF NOT EXISTS "product_quantity_budgets_branch_idx" ON "product_quantity_budgets" ("branch_id");
CREATE INDEX IF NOT EXISTS "product_quantity_budgets_product_idx" ON "product_quantity_budgets" ("global_product_id");
CREATE INDEX IF NOT EXISTS "product_quantity_budgets_period_idx" ON "product_quantity_budgets" ("period");

CREATE TABLE IF NOT EXISTS "product_quantity_budget_allocations" (
  "id" serial PRIMARY KEY,
  "quantity_budget_id" integer NOT NULL REFERENCES "product_quantity_budgets"("id") ON DELETE CASCADE,
  "budget_id" integer REFERENCES "budgets"("id") ON DELETE CASCADE,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
  "branch_id" integer NOT NULL REFERENCES "branches"("id"),
  "organization_inventory_id" integer NOT NULL REFERENCES "organization_inventory"("id") ON DELETE CASCADE,
  "global_product_id" integer NOT NULL REFERENCES "global_products"("id"),
  "period" varchar(16) NOT NULL,
  "allocation_type" varchar(32) NOT NULL,
  "quantity" integer NOT NULL,
  "price_cents" bigint NOT NULL,
  "amount_cents" bigint NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "product_quantity_budget_allocations_budget_idx"
  ON "product_quantity_budget_allocations" ("quantity_budget_id");
CREATE INDEX IF NOT EXISTS "product_quantity_budget_allocations_branch_idx"
  ON "product_quantity_budget_allocations" ("branch_id");
CREATE INDEX IF NOT EXISTS "product_quantity_budget_allocations_product_idx"
  ON "product_quantity_budget_allocations" ("global_product_id");
CREATE INDEX IF NOT EXISTS "product_quantity_budget_allocations_period_idx"
  ON "product_quantity_budget_allocations" ("period");
