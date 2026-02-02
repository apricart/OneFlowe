-- Run this SQL in your database to enable full refund functionality
-- This adds the missing columns to track refund information

-- Add refund tracking fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_by_user_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_at_refund VARCHAR(32);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Add index for refunded orders
CREATE INDEX IF NOT EXISTS orders_refunded_idx ON orders(refunded_at) WHERE refunded_at IS NOT NULL;
