-- ============================================================
-- 4-Tier Row-Level Security (RLS) Migration
-- Implements complete RBAC hierarchy:
--   1. SUPER_ADMIN: Access everything (all Orgs, Branches, Groups)
--   2. HEAD_OFFICE: Access all data within their organization_id
--   3. BRANCH_ADMIN: Access data only within their assigned branch_id
--   4. ORDER_PORTAL: Access only their own orders (created_by = auth.uid())
--
-- This migration:
-- 1. Drops old simple policies
-- 2. Creates helper functions for role/org/branch/user context
-- 3. Creates comprehensive RLS policies for each table
-- 4. Updates the tenant isolation to support 4-tier hierarchy
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTIONS FOR RBAC CONTEXT
-- ============================================================

-- Function to get current role from session variable
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_role', true);
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get current organization_id from session variable
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_org_id', true), '')::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get current branch_id from session variable
CREATE OR REPLACE FUNCTION get_my_branch_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_branch_id', true), '')::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get current user_id from session variable
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 2. DROP OLD POLICIES (if they exist)
-- ============================================================

-- Drop old tenant_isolation policies
DROP POLICY IF EXISTS tenant_isolation ON "branches";
DROP POLICY IF EXISTS tenant_isolation ON "users";
DROP POLICY IF EXISTS tenant_isolation ON "categories";
DROP POLICY IF EXISTS tenant_isolation ON "products";
DROP POLICY IF EXISTS tenant_isolation ON "skus";
DROP POLICY IF EXISTS tenant_isolation ON "inventory";
DROP POLICY IF EXISTS tenant_isolation ON "head_offices";
DROP POLICY IF EXISTS tenant_isolation ON "suppliers";
DROP POLICY IF EXISTS tenant_isolation ON "budgets";
DROP POLICY IF EXISTS tenant_isolation ON "budget_addons";
DROP POLICY IF EXISTS tenant_isolation ON "organization_settings";
DROP POLICY IF EXISTS tenant_isolation ON "org_metrics";
DROP POLICY IF EXISTS tenant_isolation ON "orders";
DROP POLICY IF EXISTS tenant_isolation ON "order_items";
DROP POLICY IF EXISTS tenant_isolation ON "refunds";
DROP POLICY IF EXISTS tenant_isolation ON "notifications";
DROP POLICY IF EXISTS tenant_isolation ON "audit_logs";
DROP POLICY IF EXISTS tenant_isolation ON "sessions";
DROP POLICY IF EXISTS tenant_isolation ON "system_logs";
DROP POLICY IF EXISTS tenant_isolation ON "organization_products";
DROP POLICY IF EXISTS tenant_isolation ON "branch_products";
DROP POLICY IF EXISTS tenant_isolation ON "restock_requests";
DROP POLICY IF EXISTS tenant_isolation ON "organization_inventory";
DROP POLICY IF EXISTS tenant_isolation ON "branch_inventory";
DROP POLICY IF EXISTS tenant_isolation ON "employee_credentials";
DROP POLICY IF EXISTS tenant_isolation ON "groups";
DROP POLICY IF EXISTS tenant_isolation ON "group_audit_logs";
DROP POLICY IF EXISTS tenant_isolation ON "scheduled_reports";

-- ============================================================
-- 3. CREATE 4-TIER RLS POLICIES
-- ============================================================

-- ====================
-- BRANCHES TABLE
-- ====================
-- SUPER_ADMIN: Full access
-- HEAD_OFFICE: Organization-level access
-- BRANCH_ADMIN: Branch-level access
-- ORDER_PORTAL: Branch-level access (can view their branch)

CREATE POLICY branches_super_admin ON "branches"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY branches_head_office ON "branches"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY branches_branch_admin ON "branches"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        (get_my_role() = 'BRANCH_ADMIN' OR get_my_role() = 'ORDER_PORTAL')
        AND id = get_my_branch_id()
    );

-- ====================
-- USERS TABLE
-- ====================
-- SUPER_ADMIN: Full access
-- HEAD_OFFICE: Organization-level access (all users in org)
-- BRANCH_ADMIN: Branch-level access (users in their branch)
-- ORDER_PORTAL: Self access only (can only view/edit themselves)

CREATE POLICY users_super_admin ON "users"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY users_head_office ON "users"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY users_branch_admin ON "users"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

CREATE POLICY users_order_portal ON "users"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'ORDER_PORTAL'
        AND id = get_my_user_id()
    );

-- ====================
-- ORDERS TABLE
-- ====================
-- SUPER_ADMIN: Full access
-- HEAD_OFFICE: Organization-level access
-- BRANCH_ADMIN: Branch-level access
-- ORDER_PORTAL: Own orders only (created_by_user_id = auth.uid())

CREATE POLICY orders_super_admin ON "orders"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY orders_head_office ON "orders"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY orders_branch_admin ON "orders"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

CREATE POLICY orders_order_portal ON "orders"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'ORDER_PORTAL'
        AND created_by_user_id = get_my_user_id()
    );

-- ====================
-- ORDER_ITEMS TABLE
-- ====================
-- Access based on parent order visibility

CREATE POLICY order_items_super_admin ON "order_items"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY order_items_head_office ON "order_items"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY order_items_branch_admin ON "order_items"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

CREATE POLICY order_items_order_portal ON "order_items"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'ORDER_PORTAL'
        AND created_by_user_id = get_my_user_id()
    );

-- ====================
-- REFUNDS TABLE
-- ====================

CREATE POLICY refunds_super_admin ON "refunds"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY refunds_head_office ON "refunds"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY refunds_branch_admin ON "refunds"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

CREATE POLICY refunds_order_portal ON "refunds"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'ORDER_PORTAL'
        AND created_by_user_id = get_my_user_id()
    );

-- ====================
-- PRODUCTS TABLE
-- ====================
-- SUPER_ADMIN: Full access
-- HEAD_OFFICE: Organization-level access
-- BRANCH_ADMIN: Organization-level access (can view org products)
-- ORDER_PORTAL: Organization-level access (can view org products)

CREATE POLICY products_super_admin ON "products"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY products_org_access ON "products"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        organization_id = get_my_org_id()
        AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN', 'ORDER_PORTAL')
    );

-- ====================
-- CATEGORIES TABLE
-- ====================

CREATE POLICY categories_super_admin ON "categories"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY categories_org_access ON "categories"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        organization_id = get_my_org_id()
        AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN', 'ORDER_PORTAL')
    );

-- ====================
-- INVENTORY TABLE
-- ====================
-- SUPER_ADMIN: Full access
-- HEAD_OFFICE: Organization-level access
-- BRANCH_ADMIN: Branch-level access (inventory at their branch)
-- ORDER_PORTAL: Branch-level access (inventory at their branch)

CREATE POLICY inventory_super_admin ON "inventory"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY inventory_head_office ON "inventory"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY inventory_branch_access ON "inventory"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        branch_id = get_my_branch_id()
        AND get_my_role() IN ('BRANCH_ADMIN', 'ORDER_PORTAL')
    );

-- ====================
-- BUDGETS TABLE
-- ====================

CREATE POLICY budgets_super_admin ON "budgets"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY budgets_head_office ON "budgets"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY budgets_branch_admin ON "budgets"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

-- ORDER_PORTAL cannot access budgets

-- ====================
-- NOTIFICATIONS TABLE
-- ====================
-- SUPER_ADMIN: Full access
-- HEAD_OFFICE: Organization-level
-- BRANCH_ADMIN: Branch-level
-- ORDER_PORTAL: Own notifications only

CREATE POLICY notifications_super_admin ON "notifications"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY notifications_head_office ON "notifications"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY notifications_branch_admin ON "notifications"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

CREATE POLICY notifications_order_portal ON "notifications"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'ORDER_PORTAL'
        AND user_id = get_my_user_id()
    );

-- ====================
-- AUDIT_LOGS TABLE
-- ====================
-- Same pattern as notifications

CREATE POLICY audit_logs_super_admin ON "audit_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY audit_logs_head_office ON "audit_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY audit_logs_branch_admin ON "audit_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

CREATE POLICY audit_logs_order_portal ON "audit_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'ORDER_PORTAL'
        AND user_id = get_my_user_id()
    );

-- ====================
-- HEAD_OFFICES TABLE
-- ====================
-- SUPER_ADMIN: Full access
-- HEAD_OFFICE: Own organization only

CREATE POLICY head_offices_super_admin ON "head_offices"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY head_offices_org ON "head_offices"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE'
        AND organization_id = get_my_org_id()
    );

-- ====================
-- SUPPLIERS TABLE
-- ====================

CREATE POLICY suppliers_super_admin ON "suppliers"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY suppliers_org_access ON "suppliers"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        organization_id = get_my_org_id()
        AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN')
    );

-- ORDER_PORTAL cannot access suppliers

-- ====================
-- SKUS TABLE
-- ====================

CREATE POLICY skus_super_admin ON "skus"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY skus_org_access ON "skus"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        organization_id = get_my_org_id()
        AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN', 'ORDER_PORTAL')
    );

-- ====================
-- EMPLOYEE_CREDENTIALS TABLE
-- ====================

CREATE POLICY employee_credentials_super_admin ON "employee_credentials"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY employee_credentials_head_office ON "employee_credentials"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY employee_credentials_branch_admin ON "employee_credentials"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

-- ORDER_PORTAL cannot access employee credentials

-- ====================
-- GROUPS TABLE
-- ====================

CREATE POLICY groups_super_admin ON "groups"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY groups_head_office ON "groups"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY groups_branch_admin ON "groups"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND EXISTS (
            SELECT 1 FROM branches 
            WHERE branches.group_id = groups.id 
            AND branches.id = get_my_branch_id()
        )
    );

-- ORDER_PORTAL cannot access groups

-- ====================
-- ORGANIZATION_PRODUCTS TABLE
-- ====================

CREATE POLICY organization_products_super_admin ON "organization_products"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY organization_products_org ON "organization_products"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        organization_id = get_my_org_id()
        AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN', 'ORDER_PORTAL')
    );

-- ====================
-- BRANCH_PRODUCTS TABLE
-- ====================

CREATE POLICY branch_products_super_admin ON "branch_products"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY branch_products_head_office ON "branch_products"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY branch_products_branch ON "branch_products"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        branch_id = get_my_branch_id()
        AND get_my_role() IN ('BRANCH_ADMIN', 'ORDER_PORTAL')
    );

-- ====================
-- RESTOCK_REQUESTS TABLE
-- ====================

CREATE POLICY restock_requests_super_admin ON "restock_requests"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY restock_requests_head_office ON "restock_requests"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY restock_requests_branch_admin ON "restock_requests"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

-- ORDER_PORTAL cannot access restock requests

-- ====================
-- ORGANIZATION_INVENTORY TABLE
-- ====================

CREATE POLICY organization_inventory_super_admin ON "organization_inventory"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY organization_inventory_org ON "organization_inventory"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        organization_id = get_my_org_id()
        AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN')
    );

-- ORDER_PORTAL cannot access org inventory

-- ====================
-- BRANCH_INVENTORY TABLE
-- ====================

CREATE POLICY branch_inventory_super_admin ON "branch_inventory"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY branch_inventory_head_office ON "branch_inventory"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY branch_inventory_branch ON "branch_inventory"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        branch_id = get_my_branch_id()
        AND get_my_role() IN ('BRANCH_ADMIN', 'ORDER_PORTAL')
    );

-- ====================
-- SESSIONS TABLE
-- ====================

CREATE POLICY sessions_super_admin ON "sessions"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY sessions_org_access ON "sessions"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        organization_id = get_my_org_id()
        AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN')
    );

CREATE POLICY sessions_user ON "sessions"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'ORDER_PORTAL'
        AND user_id = get_my_user_id()
    );

-- ====================
-- SYSTEM_LOGS TABLE
-- ====================

CREATE POLICY system_logs_super_admin ON "system_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY system_logs_org ON "system_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE' 
        AND organization_id = get_my_org_id()
    );

CREATE POLICY system_logs_branch ON "system_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND branch_id = get_my_branch_id()
    );

-- ORDER_PORTAL cannot access system logs

-- ====================
-- ORGANIZATION_SETTINGS TABLE
-- ====================

CREATE POLICY organization_settings_super_admin ON "organization_settings"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY organization_settings_head_office ON "organization_settings"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE'
        AND organization_id = get_my_org_id()
    );

-- Only HEAD_OFFICE and SUPER_ADMIN can access org settings

-- ====================
-- ORG_METRICS TABLE
-- ====================

CREATE POLICY org_metrics_super_admin ON "org_metrics"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY org_metrics_head_office ON "org_metrics"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE'
        AND organization_id = get_my_org_id()
    );

-- ====================
-- BUDGET_ADDONS TABLE
-- ====================

CREATE POLICY budget_addons_super_admin ON "budget_addons"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY budget_addons_head_office ON "budget_addons"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE'
        AND organization_id = get_my_org_id()
    );

CREATE POLICY budget_addons_branch_admin ON "budget_addons"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'BRANCH_ADMIN'
        AND EXISTS (
            SELECT 1 FROM budgets 
            WHERE budgets.id = budget_addons.budget_id
            AND budgets.branch_id = get_my_branch_id()
        )
    );

-- ====================
-- GROUP_AUDIT_LOGS TABLE
-- ====================

CREATE POLICY group_audit_logs_super_admin ON "group_audit_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY group_audit_logs_head_office ON "group_audit_logs"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE'
        AND organization_id = get_my_org_id()
    );

-- ====================
-- SCHEDULED_REPORTS TABLE
-- ====================

CREATE POLICY scheduled_reports_super_admin ON "scheduled_reports"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (get_my_role() = 'SUPER_ADMIN');

CREATE POLICY scheduled_reports_head_office ON "scheduled_reports"
    AS PERMISSIVE FOR ALL TO PUBLIC
    USING (
        get_my_role() = 'HEAD_OFFICE'
        AND organization_id = get_my_org_id()
    );

-- ============================================================
-- 4. ENABLE RLS ON TABLES (if not already enabled)
-- ============================================================

ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "head_offices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restock_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_reports" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. FORCE RLS FOR TABLE OWNERS (important!)
-- ============================================================
-- By default, table owners bypass RLS. This forces RLS to apply
-- to everyone, ensuring consistent behavior in application code.

ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "skus" FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory" FORCE ROW LEVEL SECURITY;
ALTER TABLE "head_offices" FORCE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "budgets" FORCE ROW LEVEL SECURITY;
ALTER TABLE "budget_addons" FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "org_metrics" FORCE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "system_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "branch_products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "restock_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_inventory" FORCE ROW LEVEL SECURITY;
ALTER TABLE "branch_inventory" FORCE ROW LEVEL SECURITY;
ALTER TABLE "employee_credentials" FORCE ROW LEVEL SECURITY;
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;
ALTER TABLE "group_audit_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_reports" FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 6. CREATE INDEXES FOR RLS PERFORMANCE
-- ============================================================
-- These indexes help PostgreSQL efficiently evaluate RLS policies

CREATE INDEX IF NOT EXISTS idx_orders_created_by_user_id ON orders(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_id ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_by ON order_items(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_by ON refunds(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_budgets_branch_id ON budgets(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- 7. VERIFICATION QUERY (can be run manually to verify setup)
-- ============================================================
/*
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true
ORDER BY tablename;

-- Check all policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check helper functions
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_my_role', 'get_my_org_id', 'get_my_branch_id', 'get_my_user_id');
*/
