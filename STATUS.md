# OneFlowe System Status

This document captures the current state of the major functional areas—from the features
that are fully wired and validated to the flows that still await implementation.

---

## ✅ Functional Areas That Are Live

- **Authentication & Session Management**
  - NextAuth credential + MFA flows (employees & admins) wired to Drizzle tables.
  - `middleware.ts` protects all portal routes with role-aware redirects.
- **Role-Based Portals**
  - Super Admin, Head Office, Branch Admin workspaces with respective layouts, navigation,
    and context providers (`AppContextProvider` + `SessionProvider`).
- **Organizations & Branches**
  - CRUD via `/api/v1/organizations` and `/api/v1/branches`, plus UI dialogs with inline validation.
  - Head Office “My Branches” workspace shows live branch/admin coverage with search/filter.
- **Users & Permissions**
  - Head Office/Super Admin creation flows (CreateUserDialog) call `/api/v1/users`.
  - Role-specific navigation and guarded pages (organizations, users, orders, inventory, etc.).
- **Inventory Management**
  - Head Office & Branch portals consume `/api/v1/head-office/*` and `/api/v1/branch/*` APIs
    for assignments, visibility, stock adjustments.
- **Orders & Refunds**
  - Orders APIs and `RefundManagement` component process refunds, use SWR for history.
- **Budgets**
  - Head Office budget management page reads/writes `/api/v1/budgets`, now PKR-native.
- **Dashboards**
  - KPI cards, notification rail, and charts, now backed by real analytics data:
    `/api/v1/analytics/dashboard` aggregates GMV-per-day and orders-by-branch with role scoping.
- **Reports**
  - Report pages (Sales Summary, Refund Orders, Product reports, Stock reports) share
    consistent iconography and filter controls; backend endpoints already exist under `/api/v1`.

---

## 🚧 Work Remaining / Gaps

- **Reports Data Hooks**
  - Report pages currently render empty tables/filters; they need to connect to their respective
    report endpoints (or new aggregations) to display real datasets.
- **Branch Admin KPI Metrics**
  - Core KPIs (inventory items, low stock, pending orders, budget) still show static numbers.
    Wire them to existing API counts (inventory, orders, budgets).
- **Analytics Enhancements**
  - `/api/v1/analytics/dashboard` currently returns GMV + order counts.
    Future improvements: cashflow vs. budgets, fulfillment SLA trends, branch comparisons
    (inventory health, staff productivity).
- **Real-Time Updates**
  - No websockets or push notifications; all data is SWR/fetch-based. Consider SSE or Pusher
    for critical dashboards/notifications.
- **Testing Coverage**
  - There are minimal automated tests (Jest/Playwright). Add unit + integration coverage,
    especially for API routes and analytics.
- **Mobile Responsiveness**
  - Major pages are desktop-first; audit mobile/tablet breakpoints and interactions.
- **Accessibility & Localization**
  - Most components are accessible but there’s no systematic audit (aria labels, focus traps).
  - No i18n layer; currency + strings are PKR/en-US only.
- **CI/CD Safeguards**
  - Need lint/test runs in CI, environment secrets validation, and migration safety checks.
- **Data Seeding & Demo State**
  - `lib/seed.ts` seeds base records but dashboards rely on organic data;
    add richer seed scripts to simulate realistic activity for demos.
- **Documentation**
  - Expand README/ADMIN_GUIDE with env setup, analytics endpoint descriptions, and contributor
    guidelines. STATUS.md should be updated as new areas complete.

---

## Next Steps / Recommendations

1. **Prioritize KPI data wiring** so the dashboard surface is consistent end-to-end.
2. **Connect report pages to APIs** (or design the missing queries) to unlock real analytics.
3. **Add CI lint/test gates** to keep the growing codebase stable.
4. **Backfill automated tests** for auth, budgets, inventory, and analytics.
5. **Iterate on analytics endpoint** to support additional charts (budget variance, inventory turnover).

Keeping this checklist up to date will make it easier for new contributors to see what’s complete and what still needs engineering effort.

