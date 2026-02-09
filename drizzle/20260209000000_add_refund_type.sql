-- Migration: Add refund_type column to refunds table
-- Created: 2026-02-09
-- Purpose: Distinguish between partial and full refunds

-- Add refund_type column with default value of PARTIAL
ALTER TABLE refunds 
ADD COLUMN refund_type VARCHAR(16) DEFAULT 'PARTIAL';

-- Update existing full refunds (where refund amount equals order total)
UPDATE refunds r
SET refund_type = 'FULL'
FROM orders o
WHERE r.order_id = o.id 
  AND r.amount_cents >= o.total_cents;

-- Add comment for column
COMMENT ON COLUMN refunds.refund_type IS 'Type of refund: PARTIAL or FULL';
