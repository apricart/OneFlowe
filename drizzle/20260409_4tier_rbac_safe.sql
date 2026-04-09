-- ============================================================
-- 4-Tier Row-Level Security (RLS) Migration - SAFE VERSION
-- This version only applies policies to tables we know exist
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTIONS FOR RBAC CONTEXT
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_role', true);
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_org_id', true), '')::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_branch_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_branch_id', true), '')::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

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

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', rec.policyname, rec.tablename);
    END LOOP;
END $$;

-- ============================================================
-- 3. ENABLE RLS ON CORE TABLES
-- ============================================================

ALTER TABLE IF EXISTS "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "skus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "head_offices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "budget_addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "organization_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "org_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "refund_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "system_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "organization_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "branch_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "restock_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "organization_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "branch_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "employee_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "group_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "scheduled_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "mfa_codes" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. CREATE POLICIES - SAFE VERSION
-- ============================================================

-- Helper function to check if column exists
CREATE OR REPLACE FUNCTION column_exists(tbl TEXT, col TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = tbl AND column_name = col
    );
END;
$$ LANGUAGE plpgsql;

-- ====================
-- ORGANIZATIONS TABLE
-- ====================
-- SUPER_ADMIN: Full access
-- HEAD_OFFICE: Can see their own org
-- Others: Can see their org (needed for FK references)

DO $$
BEGIN
    IF column_exists('organizations', 'id') THEN
        CREATE POLICY orgs_super_admin ON "organizations"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
            
        CREATE POLICY orgs_user_access ON "organizations"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                id = get_my_org_id()
                AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN', 'ORDER_PORTAL')
            );
    END IF;
END $$;

-- ====================
-- BRANCHES TABLE
-- ====================

DO $$
BEGIN
    IF column_exists('branches', 'organization_id') AND column_exists('branches', 'id') THEN
        CREATE POLICY branches_super_admin ON "branches"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
        
        CREATE POLICY branches_head_office ON "branches"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                get_my_role() = 'HEAD_OFFICE' 
                AND organization_id = get_my_org_id()
            );
        
        -- BRANCH_ADMIN and ORDER_PORTAL can see their assigned branch
        IF column_exists('branches', 'id') THEN
            CREATE POLICY branches_branch_access ON "branches"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    (get_my_role() = 'BRANCH_ADMIN' OR get_my_role() = 'ORDER_PORTAL')
                    AND id = get_my_branch_id()
                );
        END IF;
    END IF;
END $$;

-- ====================
-- USERS TABLE
-- ====================

DO $$
BEGIN
    IF column_exists('users', 'organization_id') THEN
        CREATE POLICY users_super_admin ON "users"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
        
        CREATE POLICY users_head_office ON "users"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                get_my_role() = 'HEAD_OFFICE' 
                AND organization_id = get_my_org_id()
            );
        
        -- BRANCH_ADMIN can see users in their branch
        IF column_exists('users', 'branch_id') THEN
            CREATE POLICY users_branch_admin ON "users"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    get_my_role() = 'BRANCH_ADMIN'
                    AND branch_id = get_my_branch_id()
                );
        END IF;
        
        -- ORDER_PORTAL can only see themselves
        IF column_exists('users', 'id') THEN
            CREATE POLICY users_order_portal ON "users"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    get_my_role() = 'ORDER_PORTAL'
                    AND id = get_my_user_id()
                );
        END IF;
    END IF;
END $$;

-- ====================
-- ORDERS TABLE
-- ====================

DO $$
BEGIN
    IF column_exists('orders', 'organization_id') THEN
        CREATE POLICY orders_super_admin ON "orders"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
        
        CREATE POLICY orders_head_office ON "orders"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                get_my_role() = 'HEAD_OFFICE' 
                AND organization_id = get_my_org_id()
            );
        
        -- BRANCH_ADMIN can see orders in their branch
        IF column_exists('orders', 'branch_id') THEN
            CREATE POLICY orders_branch_admin ON "orders"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    get_my_role() = 'BRANCH_ADMIN'
                    AND branch_id = get_my_branch_id()
                );
        END IF;
        
        -- ORDER_PORTAL can only see their own orders
        IF column_exists('orders', 'created_by_user_id') THEN
            CREATE POLICY orders_order_portal ON "orders"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    get_my_role() = 'ORDER_PORTAL'
                    AND created_by_user_id = get_my_user_id()
                );
        END IF;
    END IF;
END $$;

-- ====================
-- ORDER_ITEMS TABLE
-- ====================

DO $$
BEGIN
    IF column_exists('order_items', 'organization_id') THEN
        CREATE POLICY order_items_super_admin ON "order_items"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
        
        CREATE POLICY order_items_head_office ON "order_items"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                get_my_role() = 'HEAD_OFFICE' 
                AND organization_id = get_my_org_id()
            );
        
        IF column_exists('order_items', 'branch_id') THEN
            CREATE POLICY order_items_branch_admin ON "order_items"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    get_my_role() = 'BRANCH_ADMIN'
                    AND branch_id = get_my_branch_id()
                );
        END IF;
        
        IF column_exists('order_items', 'created_by_user_id') THEN
            CREATE POLICY order_items_order_portal ON "order_items"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    get_my_role() = 'ORDER_PORTAL'
                    AND created_by_user_id = get_my_user_id()
                );
        END IF;
    END IF;
END $$;

-- ====================
-- PRODUCTS TABLE (Organization-level)
-- ====================

DO $$
BEGIN
    IF column_exists('products', 'organization_id') THEN
        CREATE POLICY products_super_admin ON "products"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
        
        CREATE POLICY products_org_access ON "products"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                organization_id = get_my_org_id()
                AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN', 'ORDER_PORTAL')
            );
    END IF;
END $$;

-- ====================
-- CATEGORIES TABLE (Organization-level)
-- ====================

DO $$
BEGIN
    IF column_exists('categories', 'organization_id') THEN
        CREATE POLICY categories_super_admin ON "categories"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
        
        CREATE POLICY categories_org_access ON "categories"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                organization_id = get_my_org_id()
                AND get_my_role() IN ('HEAD_OFFICE', 'BRANCH_ADMIN', 'ORDER_PORTAL')
            );
    END IF;
END $$;

-- ====================
-- INVENTORY TABLE (Branch-level for some roles)
-- ====================

DO $$
BEGIN
    IF column_exists('inventory', 'organization_id') THEN
        CREATE POLICY inventory_super_admin ON "inventory"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
        
        CREATE POLICY inventory_head_office ON "inventory"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                get_my_role() = 'HEAD_OFFICE' 
                AND organization_id = get_my_org_id()
            );
        
        IF column_exists('inventory', 'branch_id') THEN
            CREATE POLICY inventory_branch_access ON "inventory"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    branch_id = get_my_branch_id()
                    AND get_my_role() IN ('BRANCH_ADMIN', 'ORDER_PORTAL')
                );
        END IF;
    END IF;
END $$;

-- ====================
-- BUDGETS TABLE (Branch-level)
-- ====================

DO $$
BEGIN
    IF column_exists('budgets', 'organization_id') AND column_exists('budgets', 'branch_id') THEN
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
    END IF;
END $$;

-- ====================
-- SUPPLIERS TABLE
-- ====================

DO $$
BEGIN
    IF column_exists('suppliers', 'organization_id') THEN
        CREATE POLICY suppliers_super_admin ON "suppliers"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (get_my_role() = 'SUPER_ADMIN');
        
        CREATE POLICY suppliers_head_office ON "suppliers"
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                get_my_role() = 'HEAD_OFFICE' 
                AND organization_id = get_my_org_id()
            );
        
        IF column_exists('suppliers', 'branch_id') THEN
            CREATE POLICY suppliers_branch_admin ON "suppliers"
                AS PERMISSIVE FOR ALL TO PUBLIC
                USING (
                    get_my_role() = 'BRANCH_ADMIN'
                    AND branch_id = get_my_branch_id()
                );
        END IF;
    END IF;
END $$;

-- ====================
-- ROLES & PERMISSIONS (System tables - restricted)
-- ====================

DO $$
BEGIN
    CREATE POLICY roles_super_admin ON "roles"
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (get_my_role() = 'SUPER_ADMIN');
    
    CREATE POLICY role_permissions_super_admin ON "role_permissions"
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (get_my_role() = 'SUPER_ADMIN');
END $$;

-- ====================
-- OTHER TABLES - Organization-level default
-- ====================

DO $$
DECLARE
    tables_with_org TEXT[] := ARRAY[
        'skus', 'head_offices', 'organization_settings', 'org_metrics',
        'organization_products', 'organization_inventory', 'system_logs',
        'employee_credentials', 'groups', 'scheduled_reports'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY tables_with_org
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            IF column_exists(tbl, 'organization_id') THEN
                EXECUTE format(
                    'CREATE POLICY %I_super_admin ON %I AS PERMISSIVE FOR ALL TO PUBLIC USING (get_my_role() = ''SUPER_ADMIN'')',
                    tbl, tbl
                );
                
                EXECUTE format(
                    'CREATE POLICY %I_org_access ON %I AS PERMISSIVE FOR ALL TO PUBLIC USING (organization_id = get_my_org_id() AND get_my_role() IN (''HEAD_OFFICE'', ''BRANCH_ADMIN''))',
                    tbl, tbl
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- ====================
-- TABLES WITH USER_ID - Personal access
-- ====================

DO $$
DECLARE
    tables_with_user TEXT[] := ARRAY[
        'notifications', 'audit_logs', 'sessions', 'mfa_codes'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY tables_with_user
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            -- SUPER_ADMIN can see all
            EXECUTE format(
                'CREATE POLICY %I_super_admin ON %I AS PERMISSIVE FOR ALL TO PUBLIC USING (get_my_role() = ''SUPER_ADMIN'')',
                tbl, tbl
            );
            
            -- Organization-level for HEAD_OFFICE
            IF column_exists(tbl, 'organization_id') THEN
                EXECUTE format(
                    'CREATE POLICY %I_head_office ON %I AS PERMISSIVE FOR ALL TO PUBLIC USING (get_my_role() = ''HEAD_OFFICE'' AND organization_id = get_my_org_id())',
                    tbl, tbl
                );
            END IF;
            
            -- Branch-level for BRANCH_ADMIN
            IF column_exists(tbl, 'branch_id') THEN
                EXECUTE format(
                    'CREATE POLICY %I_branch_admin ON %I AS PERMISSIVE FOR ALL TO PUBLIC USING (get_my_role() = ''BRANCH_ADMIN'' AND branch_id = get_my_branch_id())',
                    tbl, tbl
                );
            END IF;
            
            -- User-level for ORDER_PORTAL
            IF column_exists(tbl, 'user_id') THEN
                EXECUTE format(
                    'CREATE POLICY %I_order_portal ON %I AS PERMISSIVE FOR ALL TO PUBLIC USING (get_my_role() = ''ORDER_PORTAL'' AND user_id = get_my_user_id())',
                    tbl, tbl
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- 5. FORCE RLS FOR TABLE OWNERS
-- ============================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = true
    LOOP
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', rec.tablename);
    END LOOP;
END $$;

-- ============================================================
-- 6. CREATE INDEXES FOR RLS PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_created_by_user_id ON orders(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_id ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_budgets_branch_id ON budgets(branch_id);

-- ============================================================
-- 7. VERIFICATION
-- ============================================================

-- Return counts for verification
SELECT 
    'Helper Functions' as category,
    COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_my_role', 'get_my_org_id', 'get_my_branch_id', 'get_my_user_id', 'column_exists')

UNION ALL

SELECT 
    'Tables with RLS' as category,
    COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true

UNION ALL

SELECT 
    'RLS Policies' as category,
    COUNT(*) as count
FROM pg_policies 
WHERE schemaname = 'public';
