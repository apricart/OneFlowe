-- Add unique human-readable refund number column to refunds table
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "refund_number" varchar(20);

-- Backfill all existing refunds with Refund-000001 format based on their id
UPDATE "refunds"
SET "refund_number" = 'Refund-' || LPAD(id::text, 6, '0')
WHERE "refund_number" IS NULL;

-- Add unique constraint to prevent duplicates
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_refund_number_unique" UNIQUE ("refund_number");
