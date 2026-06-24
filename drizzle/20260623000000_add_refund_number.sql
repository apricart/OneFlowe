-- Add unique human-readable refund number column to refunds table
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "refund_number" varchar(20);

-- Backfill all existing refunds with Refund-000001 format based on their id
UPDATE "refunds"
SET "refund_number" = 'Refund-' || LPAD(id::text, 6, '0')
WHERE "refund_number" IS NULL;

-- Add the unique constraint only when it has not already been applied manually.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refunds_refund_number_unique'
      AND conrelid = 'public.refunds'::regclass
  ) THEN
    ALTER TABLE "refunds"
      ADD CONSTRAINT "refunds_refund_number_unique" UNIQUE ("refund_number");
  END IF;
END
$$;
