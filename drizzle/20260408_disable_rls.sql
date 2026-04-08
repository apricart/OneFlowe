-- Disable RLS
ALTER TABLE "branches" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "skus" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "head_offices" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_addons" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_settings" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "org_metrics" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "system_logs" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "organization_products" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_products" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "restock_requests" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "organization_inventory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_inventory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_credentials" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "groups" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "group_audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_reports" DISABLE ROW LEVEL SECURITY;

-- Drop Policies
DROP POLICY IF EXISTS tenant_isolation ON "branches";
DROP POLICY IF EXISTS tenant_isolation ON "users";
DROP POLICY IF EXISTS tenant_isolation ON "categories";
DROP POLICY IF EXISTS tenant_isolation ON "products";
DROP POLICY IF EXISTS tenant_isolation ON "skus";
DROP POLICY IF EXISTS tenant_isolation ON "inventory";
DROP POLICY IF EXISTS tenant_isolation ON "head_offices";
DROP POLICY IF EXISTS tenant_isolation ON "suppliers";
DROP POLICY IF EXISTS tenant_isolation ON "budgets";
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
