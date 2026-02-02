-- 1. Run this first to see exactly what statuses you have:
SELECT status, count(*) as count 
FROM orders 
GROUP BY status;

-- 2. If you see 'Pending' or 'Active' (or 'Current Order Pending') and want to delete them, run this:
-- WARNING: This deletes data!
/*
DELETE FROM orders 
WHERE status IN ('Pending', 'Active', 'Current Order Pending');
*/
