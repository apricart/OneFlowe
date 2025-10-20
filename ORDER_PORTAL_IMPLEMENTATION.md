# Order Portal - Separate E-Commerce Implementation

## Overview

The **Order Portal** is now a completely separate e-commerce-style application within the system at `/app/shop/`. It allows branch employees (with credentials created by Branch Admins) to place orders independently, with budget enforcement and MFA protection.

## Architecture

### Separation of Concerns

```
├── /app/shop/                          ← Order Portal (E-commerce)
│   ├── page.tsx                        ← Main product browsing & checkout
│   ├── login/page.tsx                  ← Employee login with MFA
│   └── layout.tsx                      ← Shop layout with SessionProvider
│
├── /app/(auth)/login/page.tsx          ← Main login (has "Order Portal Login" button)
│
├── /app/(portal)/                      ← Admin Dashboards (unchanged)
│   ├── dashboard/                      ← Order management & approvals
│   ├── settings/                       ← Includes Employee Credentials Manager
│   └── ...
│
└── /app/api/v1/
    ├── employee-credentials/route.ts   ← Create/manage employee creds
    └── orders/route.ts                 ← Place orders (handles employee role)
```

## Authentication Flow

### Three Distinct Login Paths

1. **Dashboard Login** (`/auth/login`)
   - For: Super Admin, Head Office, Branch Admin users
   - Credentials: User table (organizations, permissions, roles)
   - Redirects to: `/dashboard`
   - With "Order Portal Login" button to `/shop/login`

2. **Order Portal Login** (`/shop/login`)
   - For: Employees (created by Branch Admin)
   - Credentials: Employee Credentials table
   - Redirects to: `/shop`
   - Can toggle back to Dashboard login

3. **MFA Integration**
   - Both paths support optional MFA (TOTP)
   - Same OTP verification system
   - Uses `lib/mfa.ts` for OTP generation/validation

### Auth Providers (lib/auth-options.ts)

```typescript
// Dashboard Users
"credentials"              → Regular login
"mfa-credentials"          → MFA-protected login

// Portal Employees
"employee-credentials"     → Employee portal login
"employee-mfa-credentials" → Employee MFA login
```

## Database Schema

### Employee Credentials Table

```sql
CREATE TABLE "employee_credentials" (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(128),
  last_name VARCHAR(128),
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP,
  deactivated_at TIMESTAMP
);
```

**Key Relationships:**
- Linked to **one branch** (employees are branch-specific)
- Linked to **organization** (for order tracking & budgets)
- Created by **Branch Admin** (audit trail)

## API Endpoints

### Employee Credentials Management

**POST /api/v1/employee-credentials** (Branch Admin)
- Create new employee credential
- Body: `{ email, password, firstName, lastName, mfaEnabled }`
- Returns: `{ credential }`

**GET /api/v1/employee-credentials** (Branch Admin)
- List all employee credentials for branch
- Returns: `{ credentials: [...] }`

**PUT /api/v1/employee-credentials** (Branch Admin)
- Update employee info (name, MFA setting)
- Body: `{ id, firstName, lastName, mfaEnabled }`
- Returns: `{ credential }`

**DELETE /api/v1/employee-credentials** (Branch Admin)
- Deactivate employee credential (soft delete)
- Query: `?id=123`
- Returns: `{ message }`

### Orders API (Existing - Enhanced)

**POST /api/v1/orders** (All Roles)
- Employees can place orders from portal
- Enforces **branch budget** automatically
- Creates **audit log** entry with employee info
- Returns: `{ order, tid }`

**GET /api/v1/orders** (All Roles)
- Employees see own orders
- Head Office sees branch orders
- Super Admin sees all orders

## UI Components

### Order Portal - `/app/shop/page.tsx`

**Features:**
- 🎨 E-commerce style product grid (4 columns on desktop)
- 🔍 Search by product name or code
- 📊 Sort by: Name, Price (low/high), Rating
- 🛒 Shopping cart with slide-out panel
- 💰 Budget display (remaining / allocated)
- 📦 Stock status & low stock warnings
- ⭐ Product ratings (mock data)
- ✅ Checkout modal with order summary
- 🚫 Budget overflow validation

**Session Handling:**
- Redirects unauthenticated users to `/shop/login`
- Redirects non-EMPLOYEE users to `/`
- Fetches budget from `/api/v1/budgets` (branch-specific)
- Fetches products from `/api/v1/branch/inventory`

### Employee Portal Login - `/app/shop/login/page.tsx`

**Features:**
- 📧 Email input
- 🔐 Password input (with toggle visibility)
- 🔑 OTP code input (step 2)
- 🔄 Back button between steps
- 🎯 "Back to Dashboard Login" option
- ✨ Modern gradient design matching theme

### Employee Credentials Manager - `components/admin/employee-credentials-manager.tsx`

**Features (for Branch Admins):**
- ➕ Add new employee credential
- ✏️ Edit employee info (name, MFA)
- 🗑️ Deactivate employee
- 🔐 Password generator with copy
- 👁️ Password visibility toggle
- 📋 Table view with email, name, MFA status, active status
- 🔒 MFA checkbox for enabling two-factor auth
- 📅 Created date display

## Audit Logging

### Order Creation Audit
```typescript
{
  organizationId: emp.organizationId,
  userId: `emp_${employeeId}`,           // Prefixed with emp_
  action: "CREATE_ORDER",
  resourceType: "ORDER",
  resourceId: orderTid,
  details: "Order placed by employee [email]"
}
```

### Employee Credential Management Audit
```typescript
{
  organizationId: orgId,
  userId: branchAdminId,
  action: "CREATE_EMPLOYEE_CREDENTIAL",
  resourceType: "EMPLOYEE_CREDENTIAL",
  resourceId: credId,
  details: "Created employee credential for [email]"
}
```

## Order Management Workflow

### Employee Flow (Portal)
1. Employee logs in at `/shop/login` with credential
2. Browses products, uses filters/search
3. Adds items to cart
4. Checks budget indicator (real-time)
5. Proceeds to checkout
6. Order placed → Awaits approval

### Branch Admin Flow (Dashboard)
1. Logs into `/auth/login`
2. Views Orders section
3. Sees **pending employee orders**
4. Can: Approve → Fulfill, or Reject
5. Can: Process refunds (budget credited)

### Head Office Flow (Dashboard)
1. Logs into `/auth/login`
2. Reviews employee orders from branch
3. Can approve/fulfill/refund
4. Can override budget allocation

### Super Admin Flow (Dashboard)
1. Can view all employee orders
2. Can override any approvals
3. Can override budget allocation

## Budget System

### Employee Order Budget Check

```typescript
// Automatic enforcement at order creation
if (cartTotal > remainingBudget) {
  return error(400, "Exceeds remaining budget")
}

// Budget snapshot stored
{
  amountAllocatedCents: 10000,      // Head Office sets
  amountSpentCents: 2500,            // Approved orders
  amountHeldCents: 1200,             // Pending orders
  amountCreditedCents: 0,            // Refunds
  remainingCents: 6300               // Allocated - spent - held + credited
}
```

## Security Features

### Password Security
- ✅ Bcrypt hashing (10 salt rounds)
- ✅ Hashed storage in database
- ✅ No plaintext passwords in logs

### Employee-Specific Audit Trail
- ✅ Employee actions tracked with `emp_${id}` prefix
- ✅ Branch relationship maintained
- ✅ Created-by audit for credential creation

### MFA Protection
- ✅ Optional per employee
- ✅ Same TOTP system as dashboard
- ✅ Rate-limited OTP validation

### Branch Isolation
- ✅ Employees can only see own branch inventory
- ✅ Employees can only spend own branch budget
- ✅ Can't cross-branch orders

## Migration Guide

### For Branch Admins
1. Go to Settings → Employee Portal Access
2. Click "Add Employee"
3. Enter email, generate password (copy it)
4. Optionally enable MFA
5. Share credentials with employee
6. Employee logs in at `/shop/login`

### For Employees
1. Receive credentials from Branch Admin
2. Visit `/shop/login`
3. Enter email & password
4. If MFA enabled, enter OTP
5. Browse and place orders
6. Track order status

## Testing Checklist

- [ ] Employee login at `/shop/login` works
- [ ] Non-existent employee cannot login
- [ ] Wrong password rejected
- [ ] MFA required if enabled
- [ ] Employee sees only branch products
- [ ] Budget check prevents overspending
- [ ] Order audit logs employee ID
- [ ] Branch Admin can create/edit/delete credentials
- [ ] Deleted employees cannot login
- [ ] Orders appear in branch Head Office dashboard
- [ ] Dashboard approvals work for employee orders
- [ ] Budget deducted correctly on order approval

## Files Changed

### New Files
- `app/shop/page.tsx` - Order portal main page
- `app/shop/login/page.tsx` - Employee portal login
- `app/shop/layout.tsx` - Portal layout
- `app/api/v1/employee-credentials/route.ts` - Credential API
- `components/admin/employee-credentials-manager.tsx` - Credential UI
- `db/schema.ts` - Added employeeCredentials table
- `drizzle/0013_superb_scorpion.sql` - Migration

### Modified Files
- `app/(auth)/login/page.tsx` - Added "Order Portal Login" button
- `app/(portal)/settings/page.tsx` - Added Employee Credentials Manager
- `lib/auth-options.ts` - Added employee auth providers
- `db/schema.ts` - Added employeeCredentials table export

## Future Enhancements

1. **Wishlist Feature**
   - Save items for later
   - Bulk order templates

2. **Order History Analytics**
   - Most ordered items
   - Spending trends
   - Cost optimization suggestions

3. **Approval Workflows**
   - Multi-level approval (Branch > Head Office > Super Admin)
   - Notification system

4. **Bulk Operations**
   - Import orders from CSV
   - Export order history

5. **Inventory Sync**
   - Real-time stock updates
   - Low stock alerts

## Troubleshooting

### Employee Cannot Login
- Check employee is **active** (not deactivated)
- Verify correct **branch** in order scope
- Check email is **unique** (not duplicated)

### Orders Not Appearing in Dashboard
- Verify order created with correct **branch_id**
- Check **authentication role** (should be EMPLOYEE)
- Look in orders endpoint with employee filter

### Budget Issues
- Verify budget **allocated** for branch
- Check pending orders hold amount
- Confirm refund logic credits back correctly

---

**Implementation Status:** ✅ Complete
**Testing Status:** ⏳ Pending
**Documentation:** ✅ Complete
