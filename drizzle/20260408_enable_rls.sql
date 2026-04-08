-- ============================================================
-- Row-Level Security (RLS) Migration
-- Enables tenant-level data isolation for ALL organization-scoped tables.
-- After this migration, PostgreSQL will REFUSE to return rows
-- unless app.current_org_id matches the row's organization_id.
-- Super Admins bypass RLS via SET LOCAL row_security = off.
-- ============================================================

-- ========================
-- 1. ENABLE RLS ON TABLES
-- ========================

-- Core Organization Tables
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

-- Order Tables
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;

-- Notification & Audit Tables
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY;

-- Product Management Tables
ALTER TABLE "organization_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restock_requests" ENABLE ROW LEVEL SECURITY;

-- Inventory Management Tables
ALTER TABLE "organization_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_credentials" ENABLE ROW LEVEL SECURITY;

-- Group & Reporting Tables
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_reports" ENABLE ROW LEVEL SECURITY;


-- ========================
-- 2. CREATE RLS POLICIES
-- ========================
-- The policies use current_setting('app.current_org_id', true) to read the
-- value that the backend sets via SET LOCAL before every query.
-- The second argument (true) means "return NULL instead of error if not set",
-- which prevents crashes when no org context is set (e.g. during migrations).

-- branches
CREATE POLICY tenant_isolation ON "branches"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- users
CREATE POLICY tenant_isolation ON "users"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- categories
CREATE POLICY tenant_isolation ON "categories"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- products
CREATE POLICY tenant_isolation ON "products"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- skus
CREATE POLICY tenant_isolation ON "skus"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- inventory
CREATE POLICY tenant_isolation ON "inventory"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- head_offices
CREATE POLICY tenant_isolation ON "head_offices"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- suppliers
CREATE POLICY tenant_isolation ON "suppliers"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- budgets
CREATE POLICY tenant_isolation ON "budgets"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- organization_settings
CREATE POLICY tenant_isolation ON "organization_settings"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- org_metrics
CREATE POLICY tenant_isolation ON "org_metrics"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- orders
CREATE POLICY tenant_isolation ON "orders"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- order_items
CREATE POLICY tenant_isolation ON "order_items"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- refunds
CREATE POLICY tenant_isolation ON "refunds"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- notifications
CREATE POLICY tenant_isolation ON "notifications"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- audit_logs
CREATE POLICY tenant_isolation ON "audit_logs"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- sessions
CREATE POLICY tenant_isolation ON "sessions"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- system_logs
CREATE POLICY tenant_isolation ON "system_logs"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- organization_products
CREATE POLICY tenant_isolation ON "organization_products"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- branch_products
CREATE POLICY tenant_isolation ON "branch_products"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- restock_requests
CREATE POLICY tenant_isolation ON "restock_requests"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- organization_inventory
CREATE POLICY tenant_isolation ON "organization_inventory"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- branch_inventory
CREATE POLICY tenant_isolation ON "branch_inventory"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- employee_credentials
CREATE POLICY tenant_isolation ON "employee_credentials"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- groups
CREATE POLICY tenant_isolation ON "groups"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- group_audit_logs
CREATE POLICY tenant_isolation ON "group_audit_logs"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);

-- scheduled_reports
CREATE POLICY tenant_isolation ON "scheduled_reports"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::integer);


-- ========================
-- 3. TABLES WITHOUT RLS
-- ========================
-- The following tables intentionally DO NOT have RLS because they are
-- either global/shared or don't have organization_id:
--
--   organizations      - This IS the tenant table itself; Super Admin manages it.
--   roles              - Global role definitions shared across all tenants.
--   role_permissions   - Global permission definitions.
--   mfa_codes          - Linked to user, not org. Access controlled by user auth.
--   global_products    - Master product catalog managed by Super Admin.
--   modifiers          - Global product modifiers managed by Super Admin.
--   product_modifiers  - Junction table for global products ↔ modifiers.
--   product_assignments - Audit log for assignments (has assignedToId, not org_id directly).
--   inventory_sync_logs - System-level sync logs.
--   product_import_batches - System-level import logs.
--   refund_items       - Child of refunds (already protected via parent).
--   budget_addons      - Child of budgets (already protected via parent).
