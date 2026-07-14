# K-Electric legacy order import runbook

This import is intentionally limited to database organization `10`, code `0001`,
name `K-Electric`. It does not import refunds and cannot target another tenant.

## What is eligible

An order is eligible only when all of these are true:

- it exists in `reports/order.json` and has item rows in `sales-report.json`;
- legacy status is delivered (`StatusID=2`, `DeliveryStatus=507`);
- its refund amount is zero;
- its item subtotal, tax, and grand total reconcile exactly in integer cents;
- conflicting price reports do not require choosing one source by precedence;
- its branch and active user resolve uniquely inside K-Electric;
- every product resolves uniquely by an existing import mapping, exact source code,
  or exact normalized name; otherwise it is a clearly reported new product;
- its legacy source ID/checksum has not already been imported.

The current source snapshot produces 594 financially safe candidates offline.
The database dry run may reduce the ready count when a branch/user/product mapping
is unresolved. A reduced count is a blocker, not an invitation to guess.

## Deliberately excluded side effects

Historical fulfilled orders are written in the report-facing `orders` and
`order_items` shape, but the importer does not consume current stock, hold/spend
current budgets, alter quantity budgets, advance invoice sequences, generate
approval tokens, or send operational notifications. Products and assignments
created only for history are inactive/hidden with zero stock.

When a legacy creator has no truthful current-user match, the explicitly gated
`--allow-historical-users` mode creates one deterministic, inactive ORDER_PORTAL
identity per legacy-user/branch pair. Its random password is discarded, it cannot
log in, and its mapping is recorded in `legacy_user_mappings`. Existing users may
only be selected through a checksum-covered override and must be active, in the
same K-Electric branch, and have the ORDER_PORTAL role.

The importer creates/uses K-Electric groups from the legacy group value and only
sets a branch whose `group_id` is currently null. It refuses to overwrite an
existing different group.

## Reporting boundary

The imported set feeds order, product, user, branch, organization, and group
reports through the same `orders`/`order_items` relationships used by the app.
The source does not contain a trustworthy product-category mapping, so newly
created products appear as `Uncategorized` until categories are reviewed in the
normal product-management flow. Historical budget allocations are not imported:
the provided budget export has no reliable allocation tenure, and changing live
budgets would corrupt current availability. Refund reporting is excluded by
request. Active, cancelled, refunded, and financially ambiguous legacy rows stay
quarantined and are listed by reason rather than being converted to invented app
states.

## Required sequence

1. Run `npm run import:ke-legacy -- --overrides=config/ke-legacy-import-overrides.json --allow-historical-users --output=reports/ke-import-preflight.json`.
   This reads the database and writes only the local review file.
2. Resolve every printed blocker explicitly. Never edit the script to bypass a
   tenant, checksum, uniqueness, or financial gate. If an explicit mapping is
   required, copy `config/ke-legacy-import-overrides.example.json`, fill only
   verified IDs, and pass `--overrides=<path>`. The override file hash becomes
   part of the required manifest confirmation.
3. Back up the production database and record the restore point.
4. Review and apply `drizzle/20260711000000_add_legacy_import_ledger.sql`.
5. Re-run the same dry run. Require `Ledger migration present: true` and
   `Blocking issues: 0`, then verify the exact ready count, proposed products,
   manifest digest, and K-Electric identity.
6. In a maintenance window, run the commit command below using an active
   SUPER_ADMIN UUID and the values from that same dry run:

   `npm run import:ke-legacy -- --commit --actor-user-id=<uuid> --confirm-organization=10:0001:K-Electric --confirm-manifest=<digest> --expected-orders=<ready> --allow-new-products --allow-historical-users --overrides=config/ke-legacy-import-overrides.json`

All writes occur in one transaction protected by an organization-scoped advisory
lock. Any error rolls back the entire batch.

## Post-import validation

Run `npm run validate:ke-legacy -- backups/ke-import-state-2026-07-13-pre-migration.json`.

- Compare imported batch count and total cents with the dry-run values.
- Verify K-Electric order, product, user, branch, organization, and group reports.
- Verify a different organization and several of its branches are unchanged.
- Verify global stock, K-Electric budgets, quantity budgets, and invoice sequence
  values match their pre-import snapshots.
- Keep the batch UUID and manifest digest with the deployment record.

If validation fails, use the guarded rollback command:

`npm run rollback:ke-legacy -- --batch-id=<uuid> --actor-user-id=<uuid> --confirm=ROLLBACK:<uuid>:KE-ONLY`

Rollback deletes only the batch-owned orders and items. It retains product and
group assignments and inactive historical identities because later configuration
or imports may depend on them.

## Legacy product-code normalization

The completed K-Electric batch owns 144 historical-only products (global product
IDs `165` through `308`). Their canonical codes are `PRD--20` through
`PRD--163`; the 5,171 corresponding imported order-item snapshots must carry the
same codes. Product ID `7` (`PRD-007`, Sugar) was reused and is deliberately
outside this renumbering.

Before normalization, product ID `203` had one accidental UBL organization
assignment (`organization_inventory.id=320`). The guarded migration may remove
that exact assignment only when it still has no branch inventory, orders,
budgets, allocations, restock requests, legacy mappings, or parallel product
assignments. Any additional cross-tenant reference aborts the transaction.

Required workflow:

1. Apply `drizzle/20260713010000_add_normalized_global_product_code_uniqueness.sql`.
   It refuses to install if active product codes collide after trimming and
   case-folding.
2. Save a fresh safety snapshot and dry-run report.
3. Run the full rollback rehearsal with `--simulate`; it executes all mutations
   and validations, then rolls the transaction back.
4. Apply only with the saved preflight, an active SUPER_ADMIN actor, and the exact
   confirmation printed by the dry run.
5. Independently validate the commit and its immediate baseline:

   `npm run validate:ke-legacy-products -- --commit-report=<commit.json> --baseline=<pre-change-snapshot.json>`

The validator checks the code mapping, all K-Electric import totals, audit pair,
normalized unique index, absence of cross-tenant references, and the protected
pre-change rows. It permits only the intended 144 catalog code/timestamp changes
and 5,171 order-item code changes. The next canonical product code is
`PRD--164`.

Emergency rollback is intentionally separate and defaults to read-only:

`npm run rollback:ke-legacy-products -- --commit-report=<commit.json>`

An apply rollback additionally requires the original actor and the exact
confirmation printed by its dry run. It refuses to restore the old codes or UBL
assignment if later orders, assignments, mappings, or other dependencies now use
the affected products.
