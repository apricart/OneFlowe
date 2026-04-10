-- ============================================================
-- MANUAL RLS TESTING GUIDE
-- Run these queries in Supabase SQL Editor or psql
-- ============================================================

-- 1. GET TEST USER IDs
-- First, find the user IDs you want to test with
SELECT id, username, role_id, organization_id, branch_id 
FROM users 
WHERE username IN ('headoffice', 'branchadmin', 'orderportal', 'yousuf');

-- 2. TEST SUPER_ADMIN (should see ALL users)
-- Set session as SUPER_ADMIN
SET SESSION row_security = off;
SELECT 'SUPER_ADMIN View' as test, COUNT(*) as total_users FROM users;

-- 3. TEST HEAD_OFFICE (should see only their org users)
-- Replace '2' with actual organization_id from step 1
SET SESSION row_security = on;
SET SESSION "app.current_role" = 'HEAD_OFFICE';
SET SESSION "app.current_org_id" = '2';
SELECT 'HEAD_OFFICE View' as test, username, organization_id, branch_id 
FROM users 
LIMIT 10;

-- 4. TEST BRANCH_ADMIN (should see only their branch users)
-- Replace '2' with actual organization_id and branch_id from step 1
SET SESSION "app.current_role" = 'BRANCH_ADMIN';
SET SESSION "app.current_org_id" = '2';
SET SESSION "app.current_branch_id" = '2';
SELECT 'BRANCH_ADMIN View' as test, username, organization_id, branch_id 
FROM users 
LIMIT 10;

-- 5. TEST ORDER_PORTAL (most restrictive - own records only)
-- Replace with actual user_id from step 1
SET SESSION "app.current_role" = 'ORDER_PORTAL';
SET SESSION "app.current_org_id" = '2';
SET SESSION "app.current_branch_id" = '2';
SET SESSION "app.current_user_id" = '[REPLACE_WITH_USER_ID]';
SELECT 'ORDER_PORTAL View' as test, username, organization_id, branch_id 
FROM users 
LIMIT 10;

-- 6. CHECK RLS POLICIES APPLIED
SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- 7. TEST ORDERS TABLE RLS
-- Create a test order first (as SUPER_ADMIN)
SET SESSION row_security = off;
INSERT INTO orders (id, organization_id, branch_id, created_by, status, total_amount_cents)
VALUES (gen_random_uuid(), 2, 2, '[USER_ID]', 'pending', 10000);

-- 8. VERIFY ORDER VISIBILITY BY ROLE
-- As HEAD_OFFICE (should see org orders)
SET SESSION row_security = on;
SET SESSION "app.current_role" = 'HEAD_OFFICE';
SET SESSION "app.current_org_id" = '2';
SELECT 'HEAD_OFFICE Orders' as test, COUNT(*) as order_count FROM orders;

-- As BRANCH_ADMIN (should see branch orders only)
SET SESSION "app.current_role" = 'BRANCH_ADMIN';
SET SESSION "app.current_org_id" = '2';
SET SESSION "app.current_branch_id" = '2';
SELECT 'BRANCH_ADMIN Orders' as test, COUNT(*) as order_count FROM orders;

-- 9. RESET SESSION
RESET row_security;
RESET "app.current_role";
RESET "app.current_org_id";
RESET "app.current_branch_id";
RESET "app.current_user_id";

-- 10. VERIFY RLS IS ENABLED ON TABLES
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'orders', 'organizations', 'branches', 'products')
ORDER BY tablename;
