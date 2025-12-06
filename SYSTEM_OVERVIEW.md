## 🧩 Apricart OneFlowe – System Overview

Apricart OneFlowe is a **multi-tenant retail operations platform** with:
- **Super Admin console** for global configuration and master data
- **Organization / Branch portal** for day‑to‑day operations (inventory, orders, budgets)
- **Employee Order Portal** for branch employees to place e‑commerce style orders under strict budget control

This document gives a **brief mental model** of how the pieces fit together. For deep dives, see:
- `INVENTORY_SYSTEM.md` – Global → Organization → Branch inventory
- `ORDER_PORTAL_IMPLEMENTATION.md` – Employee order portal
- `ADMIN_GUIDE.md` – Super Admin dashboard
- `QUICK_START_ORDER_PORTAL.md` – Getting started with the Order Portal

---

## 🏗 High‑Level Architecture

At a high level, the system is a **Next.js 14 (App Router)** application backed by **PostgreSQL + Drizzle**, with a **role‑based access control (RBAC)** layer and a **three‑tier inventory + budget model**.

```text
┌─────────────────────┐
│  Super Admin        │  → Global config, master catalog, system settings
└─────────▲───────────┘
          │
┌─────────┴───────────┐
│ Head Office         │  → Org‑level products, budgets, reporting
└─────────▲───────────┘
          │
┌─────────┴───────────┐
│ Branch Admin        │  → Branch stock, local suppliers, approvals
└─────────▲───────────┘
          │
┌─────────┴───────────┐
│ Branch Employees    │  → Order Portal (shop) for placing orders
└─────────────────────┘
```

Everything flows **top‑down for configuration** (products, budgets, permissions) and **bottom‑up for activity** (orders, stock changes, audit logs).

---

## 👤 Authentication, Roles & Entry Points

There are **two main login surfaces**, both ultimately backed by NextAuth with custom providers (`lib/auth-options.ts`):

- **Dashboard Login** – `"/auth/login"`
  - For: Super Admin, Head Office, Branch Admin
  - Redirects into: `/(portal)/...` or `(super-admin)/...` depending on role
  - Uses standard user accounts + MFA

- **Order Portal Login** – `"/shop/login"`
  - For: Branch employees only
  - Uses the `employee_credentials` table (separate from dashboard users)
  - Optional per‑employee MFA using the same TOTP system

Roles are enforced by:
- `lib/permissions.ts` / `lib/rbac.ts` – role → permission mapping
- `lib/auth.ts` / `middleware.ts` – session + route protection
- UI gates in page components and shared layout (`app/(portal)/layout.tsx`, `app/(super-admin)/layout.tsx`, `app/shop/layout.tsx`)

---

## 🗂 Core Domains and How They Connect

### 1. Inventory (What can be ordered, and where?)

Documented in detail in `INVENTORY_SYSTEM.md`.

- **Global Products** – Super Admin owns the **master catalog**
- **Organization Products** – Head Office decides **which products** each organization uses, and can customize e.g. names/prices
- **Branch Products** – Branch Admins manage **actual stock and availability**

Data flows:
- Super Admin → assigns products to organizations
- Head Office → enables/disables + customizes + assigns to branches
- Branch Admin → manages stock levels and availability
- Order Portal → only shows **enabled + in‑stock branch products**

Key APIs under `app/api/v1/inventory/*` back all three levels and are consumed by:
- Super Admin inventory UI (`components/inventory/*`, `(super-admin)/global-inventory/...`)
- Head‑office/branch inventory pages in `app/(portal)/inventory/...`
- Order Portal product listing in `app/shop/page.tsx`

### 2. Budgets (How much can a branch spend?)

Budgets are tracked at **branch level** and enforced at **order creation time**.

- Head Office / Branch Admin configure budgets in the portal (budget UIs under `app/(portal)/budgets` + related components)
- The Order Portal calls budget APIs to get:
  - `amountAllocated`
  - `amountSpent`
  - `amountHeld` (pending approvals)
  - `amountCredited` (refunds)
- The order creation API rejects any cart that would exceed the **remaining** budget

This connects:
- **Configuration side** – `/(portal)/budgets` + budget APIs
- **Execution side** – `/api/v1/orders` as called from `/app/shop/page.tsx`

### 3. Orders & Approvals (What employees actually do)

The order lifecycle links the **Order Portal** and the **Dashboard**:

1. Employee browses products in `/shop` (Order Portal)
   - Products come from branch‑level inventory endpoints
   - Budget pulled from the budget API for the employee’s branch
2. Employee checks out
   - `/api/v1/orders` validates budget + stock
   - Creates an order tied to `organization`, `branch`, and **employee credential**
   - Writes an audit log entry
3. Approvals happen inside the admin portal:
   - Branch Admin / Head Office review orders in `/(portal)/orders` & `/(portal)/head-office-orders`
   - They can approve, fulfill, reject, and refund
4. Budget & stock updates:
   - Approved orders move held amounts into spent
   - Refunds credit budget back
   - Inventory is adjusted based on ordered quantities

The same orders API is role‑aware:
- Employees see **their own** orders
- Branch / Head Office see **branch** orders
- Super Admin can see **all** orders

### 4. Audit, Security & Observability

Cross‑cutting concerns:

- **Audit logs** (documented in `ADMIN_GUIDE.md` and `INVENTORY_SYSTEM.md`)
  - Every sensitive action (inventory change, order, credential change) emits an audit record
  - Employee actions are tagged with `emp_${id}` so you can distinguish them from dashboard users

- **MFA + Passwords**
  - All passwords are stored as bcrypt hashes
  - Same MFA engine (`lib/mfa.ts`) powers both dashboard and employee flows

- **RBAC**
  - `permissions.ts` defines granular permissions
  - UI and APIs check for the right permission **and** organization/branch scope before acting

---

## 🧭 Primary App Surfaces (Where to click)

- `/(super-admin)/admin` – Super Admin configuration hub
  - Role & permission management
  - Organization‑level settings
  - Global inventory, global analytics

- `/(portal)/dashboard` – Head Office / Branch Admin operational dashboard
  - Orders, approvals, refunds
  - Inventory at org/branch level
  - Budgets, reports, and settings (including Employee Credentials)

- `/shop` – Employee Order Portal
  - Branch employees place orders against their branch budget
  - Real‑time budget and stock indicators

---

## 🗺 Directory Cheat‑Sheet

High‑level folders you’ll touch most often:

- `app/(super-admin)/...` – Super Admin UI pages
- `app/(portal)/...` – Head Office / Branch Admin UI pages
- `app/shop/...` – Employee Order Portal
- `app/api/v1/...` – REST‑style JSON APIs for inventory, orders, budgets, credentials, etc.
- `components/admin/...` – Admin‑only shared components (permissions, settings, employee credentials)
- `components/dashboard/...` – Role‑aware dashboards
- `components/inventory/...` – Shared inventory UIs used across roles
- `db/schema.ts` – Drizzle schema (tables, relations)
- `lib/*.ts` – Cross‑cutting concerns (auth, RBAC, inventory utilities, MFA, Redis cache, etc.)

If you keep this mental picture—**Global → Org → Branch → Employee**, with **Inventory + Budgets feeding the Order Portal and Admin UIs**—you’ll be able to navigate and extend the system quickly.


