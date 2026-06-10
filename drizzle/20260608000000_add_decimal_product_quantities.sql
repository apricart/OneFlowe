ALTER TABLE "global_products"
  ADD COLUMN IF NOT EXISTS "allow_decimal_quantity" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quantity_step" numeric(12, 3) NOT NULL DEFAULT 1;

ALTER TABLE "global_products"
  ALTER COLUMN "stock_quantity" TYPE numeric(12, 3)
  USING "stock_quantity"::numeric(12, 3);

ALTER TABLE "order_items"
  ALTER COLUMN "quantity" TYPE numeric(12, 3)
  USING "quantity"::numeric(12, 3);

ALTER TABLE "refund_items"
  ALTER COLUMN "quantity" TYPE numeric(12, 3)
  USING "quantity"::numeric(12, 3);

ALTER TABLE "restock_requests"
  ALTER COLUMN "requested_quantity" TYPE numeric(12, 3)
  USING "requested_quantity"::numeric(12, 3),
  ALTER COLUMN "current_stock" TYPE numeric(12, 3)
  USING "current_stock"::numeric(12, 3);

ALTER TABLE "product_quantity_budgets"
  ALTER COLUMN "allocated_quantity" TYPE numeric(12, 3)
  USING "allocated_quantity"::numeric(12, 3),
  ALTER COLUMN "held_quantity" TYPE numeric(12, 3)
  USING "held_quantity"::numeric(12, 3),
  ALTER COLUMN "used_quantity" TYPE numeric(12, 3)
  USING "used_quantity"::numeric(12, 3),
  ALTER COLUMN "credited_quantity" TYPE numeric(12, 3)
  USING "credited_quantity"::numeric(12, 3);

ALTER TABLE "product_quantity_budget_allocations"
  ALTER COLUMN "quantity" TYPE numeric(12, 3)
  USING "quantity"::numeric(12, 3);

ALTER TABLE "global_products"
  ADD CONSTRAINT "global_products_quantity_step_positive_chk"
  CHECK ("quantity_step" > 0);

ALTER TABLE "global_products"
  ADD CONSTRAINT "global_products_whole_quantity_step_chk"
  CHECK ("allow_decimal_quantity" = true OR "quantity_step" = 1);
