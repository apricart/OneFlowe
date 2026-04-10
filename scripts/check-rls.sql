-- RLS Validation Queries
-- Run these in Supabase SQL Editor to verify RLS is properly configured

-- 1. Check RLS is enabled on tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  forcerowsecurity as rls_forced
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('orders', 'branches', 'organizations', 'users', 'products', 'inventory', 'suppliers')
ORDER BY tablename;

-- 2. Check RLS policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Check if tables have proper indexes for performance
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexdef LIKE '%created_at%' OR indexdef LIKE '%organization_id%' OR indexdef LIKE '%branch_id%'
ORDER BY tablename, indexname;

-- 4. Test RLS for SUPER_ADMIN (should see all orders)
SET ROLE postgres;
SET SESSION row_security = on;
SELECT 
  'SUPER_ADMIN View' as test,
  COUNT(*) as total_orders,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM orders;

-- 5. Test data exists
SELECT 
  'Data Check' as test,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM branches) as branches_count,
  (SELECT COUNT(*) FROM organizations) as orgs_count,
  (SELECT COUNT(*) FROM users) as users_count;
