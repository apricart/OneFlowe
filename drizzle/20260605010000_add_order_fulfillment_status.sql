ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "fulfillment_status" varchar(32) NOT NULL DEFAULT 'NOT_STARTED';

CREATE INDEX IF NOT EXISTS "orders_fulfillment_status_idx"
ON "orders" ("fulfillment_status");
