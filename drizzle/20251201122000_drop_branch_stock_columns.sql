ALTER TABLE "branch_inventory"
  DROP COLUMN IF EXISTS "stock_quantity",
  DROP COLUMN IF EXISTS "reorder_threshold";

ALTER TABLE "branch_products"
  DROP COLUMN IF EXISTS "stock_quantity",
  DROP COLUMN IF EXISTS "reserved_quantity",
  DROP COLUMN IF EXISTS "reorder_threshold",
  DROP COLUMN IF EXISTS "reorder_quantity",
  DROP COLUMN IF EXISTS "last_restock_date";

ALTER TABLE "inventory"
  DROP COLUMN IF EXISTS "quantity",
  DROP COLUMN IF EXISTS "reserved_quantity",
  DROP COLUMN IF EXISTS "reorder_threshold";


