# 4-Tier RBAC Implementation Guide

## Overview

This document describes the 4-tier Role-Based Access Control (RBAC) system implemented in the application using PostgreSQL Row-Level Security (RLS) policies.

## Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    4-TIER RBAC HIERARCHY                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tier 4: SUPER_ADMIN                                        │
│  ├─ Access: ALL organizations, branches, groups, data       │
│  └─ RLS: Bypasses all policies (row_security = off)         │
│                                                             │
│  Tier 3: HEAD_OFFICE                                        │
│  ├─ Access: All data within their organization_id           │
│  └─ RLS: organization_id = get_my_org_id()                  │
│                                                             │
│  Tier 2: BRANCH_ADMIN                                       │
│  ├─ Access: Data within their assigned branch_id            │
│  └─ RLS: branch_id = get_my_branch_id()                     │
│                                                             │
│  Tier 1: ORDER_PORTAL                                       │
│  ├─ Access: Only their own orders (created_by = user_id)    │
│  └─ RLS: created_by_user_id = get_my_user_id()              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

### Components

1. **PostgreSQL Helper Functions**
   - `get_my_role()` - Returns current role from session
   - `get_my_org_id()` - Returns organization_id from session
   - `get_my_branch_id()` - Returns branch_id from session
   - `get_my_user_id()` - Returns user_id from session

2. **RLS Policies**
   - Multiple policies per table (one per role tier)
   - Policies use helper functions to determine access
   - `FORCE ROW LEVEL SECURITY` ensures policies apply to all users

3. **Database Client (`lib/db.ts`)**
   - `withTenant(user, callback)` - Sets session variables before executing queries
   - Automatically sets role, org_id, branch_id, user_id based on user context

## File Structure

```
drizzle/
├── 20260408_enable_rls.sql          # Original org-level RLS
├── 20260409_4tier_rbac.sql          # NEW: 4-tier RBAC policies ⭐

lib/
├── db.ts                            # Database client with withTenant()

scripts/
├── run-rls-migration.ts             # Original migration runner
├── run-4tier-rls-migration.ts      # NEW: 4-tier migration runner ⭐

docs/
├── 4TIER_RBAC_GUIDE.md              # This documentation
```

## Implementation Steps

### 1. Run the Migration

```bash
# Run on local database
npx tsx scripts/run-4tier-rls-migration.ts local

# Run on production database
npx tsx scripts/run-4tier-rls-migration.ts production
```

### 2. API Route Usage

All API routes should use `withTenant()` with the full user context:

```typescript
import { withTenant } from "@/lib/db"

// Build tenant user context
const tenantUser = {
  role: session.user.role,                // "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN" | "ORDER_PORTAL"
  organizationId: session.user.organizationId,  // number | null
  branchId: session.user.branchId,                // number | null
  id: session.user.id                             // string | null (user UUID)
}

// Execute query within tenant context
const result = await withTenant(tenantUser, async (tx) => {
  // RLS automatically filters data based on user role
  return tx.select().from(ordersTable)
})
```

### 3. Example: Orders Route

```typescript
// Before (manual filtering):
const conditions = []
if (role === "BRANCH_ADMIN") {
  conditions.push(eq(orders.branchId, userBranchId))
} else if (role === "ORDER_PORTAL") {
  conditions.push(eq(orders.createdByUserId, userId))
}
const result = await tx.select().from(orders).where(and(...conditions))

// After (RLS handles it):
const tenantUser = {
  role: role,
  organizationId: userOrgId,
  branchId: userBranchId,
  id: userId
}
const result = await withTenant(tenantUser, async (tx) => {
  return tx.select().from(orders)  // RLS automatically filters!
})
```

## Policy Reference

### Orders Table

| Role | Policy | Condition |
|------|--------|-----------|
| SUPER_ADMIN | `orders_super_admin` | Full access (bypass RLS) |
| HEAD_OFFICE | `orders_head_office` | `organization_id = get_my_org_id()` |
| BRANCH_ADMIN | `orders_branch_admin` | `branch_id = get_my_branch_id()` |
| ORDER_PORTAL | `orders_order_portal` | `created_by_user_id = get_my_user_id()` |

### Users Table

| Role | Policy | Condition |
|------|--------|-----------|
| SUPER_ADMIN | `users_super_admin` | Full access |
| HEAD_OFFICE | `users_head_office` | `organization_id = get_my_org_id()` |
| BRANCH_ADMIN | `users_branch_admin` | `branch_id = get_my_branch_id()` |
| ORDER_PORTAL | `users_order_portal` | `id = get_my_user_id()` (self only) |

### Products Table

| Role | Policy | Condition |
|------|--------|-----------|
| SUPER_ADMIN | `products_super_admin` | Full access |
| All Others | `products_org_access` | `organization_id = get_my_org_id()` |

## Security Guarantees

1. **Defense in Depth**: Even if application code has bugs, RLS prevents unauthorized access
2. **Automatic Enforcement**: No manual filtering needed in queries
3. **Consistent Access Control**: Same rules apply regardless of query path
4. **Audit Trail**: All access is logged through PostgreSQL

## Testing

### Verify Helper Functions

```sql
-- Set context
SET app.current_role = 'BRANCH_ADMIN';
SET app.current_org_id = '1';
SET app.current_branch_id = '2';
SET app.current_user_id = '123e4567-e89b-12d3-a456-426614174000';

-- Test functions
SELECT 
  get_my_role() as role,
  get_my_org_id() as org_id,
  get_my_branch_id() as branch_id,
  get_my_user_id() as user_id;
```

### Verify RLS is Active

```sql
-- Check RLS enabled tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true
ORDER BY tablename;

-- Check policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Test Role-Based Access

```sql
-- As ORDER_PORTAL user
SET app.current_role = 'ORDER_PORTAL';
SET app.current_user_id = 'actual-user-uuid';
SELECT * FROM orders;  -- Should only see their orders

-- As BRANCH_ADMIN
SET app.current_role = 'BRANCH_ADMIN';
SET app.current_branch_id = '2';
SELECT * FROM orders;  -- Should only see branch 2 orders

-- As HEAD_OFFICE
SET app.current_role = 'HEAD_OFFICE';
SET app.current_org_id = '1';
SELECT * FROM orders;  -- Should see all org 1 orders
```

## Troubleshooting

### 401/403 Errors

1. **Check user context is complete**: Ensure `withTenant()` receives all fields
2. **Verify session variables are set**: Use `get_my_role()`, `get_my_org_id()`, etc.
3. **Check RLS policies exist**: Query `pg_policies` to verify
4. **Check table has RLS enabled**: Query `pg_tables` for `rowsecurity = true`

### Missing Data

1. **Verify user has correct role**: Check `users.roleId` → `roles.name`
2. **Check organization/branch assignment**: Verify `users.organizationId` and `users.branchId`
3. **Check data ownership**: For ORDER_PORTAL, verify `orders.createdByUserId`

### Migration Failures

```bash
# If migration fails with "already exists"
# Option 1: Drop existing policies manually
DROP POLICY IF EXISTS policy_name ON table_name;

# Option 2: Use IF NOT EXISTS in migration SQL
```

## Migration Rollback

If you need to rollback to the previous org-level RLS:

```sql
-- Drop 4-tier policies
DROP POLICY IF EXISTS orders_super_admin ON orders;
DROP POLICY IF EXISTS orders_head_office ON orders;
DROP POLICY IF EXISTS orders_branch_admin ON orders;
DROP POLICY IF EXISTS orders_order_portal ON orders;
-- ... (repeat for all tables)

-- Re-create original tenant_isolation policy
CREATE POLICY tenant_isolation ON orders
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_org_id', true)::integer);

-- Disable FORCE RLS
ALTER TABLE orders NO FORCE ROW LEVEL SECURITY;
```

## Performance Considerations

1. **Indexes**: Migration creates indexes on `organization_id`, `branch_id`, `created_by_user_id`
2. **Query Planning**: PostgreSQL can use these indexes for RLS policy evaluation
3. **Connection Pooling**: Use direct connection (port 5432) for DDL, PgBouncer (6543) for queries

## Best Practices

1. **Always use `withTenant()`**: Never query tenant-scoped tables without it
2. **Pass complete user context**: Include role, orgId, branchId, and id
3. **Test each role tier**: Verify each role can only access their allowed data
4. **Monitor for errors**: Watch logs for 401/403 errors after deployment
5. **Keep migrations idempotent**: Use `IF NOT EXISTS` and `IF EXISTS` clauses

## Support

For issues or questions:
1. Check this guide first
2. Verify migration ran successfully
3. Test helper functions
4. Review application logs
5. Query `pg_policies` and `pg_tables` for RLS status
