ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "organization_inventory_id" integer;

CREATE INDEX IF NOT EXISTS "order_items_organization_inventory_idx"
  ON "order_items" ("organization_inventory_id");
