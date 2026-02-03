-- Add refund_items table to track which items were refunded
CREATE TABLE IF NOT EXISTS "refund_items" (
  "id" serial PRIMARY KEY,
  "refund_id" integer NOT NULL REFERENCES "refunds"("id") ON DELETE CASCADE,
  "order_item_id" integer NOT NULL REFERENCES "order_items"("id"),
  "quantity" integer NOT NULL,
  "amount_cents" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "refund_items_refund_idx" ON "refund_items"("refund_id");
CREATE INDEX IF NOT EXISTS "refund_items_order_item_idx" ON "refund_items"("order_item_id");
