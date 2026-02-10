import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import {
  organizations,
  branches,
  users,
  orders,
  headOffices,
  employeeCredentials,
  organizationSettings,
  orgMetrics,
  sessions,
  auditLogs,
  notifications,
  organizationProducts,
  organizationInventory,
  categories,
  products,
  skus,
  inventory,
  suppliers,
  budgets,
  groups,
  systemLogs,
  groupAuditLogs
} from "@/db/schema"
import { eq, count, and, ne } from "drizzle-orm"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { id } = await params

  // BOLA Protection
  const orgId = Number(id)
  const { verifyResourceAccess } = await import("@/lib/auth")
  const hasAccess = await verifyResourceAccess(orgId)
  if (!hasAccess) return error("Forbidden: You do not have access to this organization", 403)

  const [item] = await db.select().from(organizations).where(eq(organizations.id, orgId))
  if (!item) return error("Not found", 404)
  return ok({ item })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  try {
    const { id } = await params
    const patch: any = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      // Check for duplicate name
      const exists = await db.select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.name, name), ne(organizations.id, Number(id))))
        .limit(1)
      if (exists.length > 0) return error(`Organization with name '${name}' already exists`, 400)
      patch.name = name
    }
    if (body.code !== undefined) {
      const code = String(body.code).trim().toUpperCase()
      // Check for duplicate code
      const exists = await db.select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.code, code), ne(organizations.id, Number(id))))
        .limit(1)
      if (exists.length > 0) return error(`Organization with code '${code}' already exists`, 400)
      patch.code = code
    }
    if (body.status !== undefined) patch.status = String(body.status)
    const [item] = await db.update(organizations).set(patch).where(eq(organizations.id, Number(id))).returning()
    return ok({ item })
  } catch (e: any) {
    return error(e?.message || "Update failed", 400)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  const orgId = Number(id)

  try {
    // 0. Check if it exists
    const [existing] = await db.select().from(organizations).where(eq(organizations.id, orgId))
    if (!existing) return error("Organization not found", 404)

    // 1. Tier 1: Check for Critical Blockers (Data the user must handle manually)
    // These tables contain core business entities that shouldn't be auto-deleted.

    const [branchCount] = await db.select({ val: count() }).from(branches).where(eq(branches.organizationId, orgId))
    if (branchCount.val > 0) {
      return error(`Cannot delete: This organization has ${branchCount.val} active branch(es). Please delete the branches first.`, 400)
    }

    const [userCount] = await db.select({ val: count() }).from(users).where(eq(users.organizationId, orgId))
    if (userCount.val > 0) {
      return error(`Cannot delete: This organization has ${userCount.val} active user(s). Please remove or reassign users first.`, 400)
    }

    const [orderCount] = await db.select({ val: count() }).from(orders).where(eq(orders.organizationId, orgId))
    if (orderCount.val > 0) {
      return error(`Cannot delete: Historical order records were found. Organizations with financial transaction history cannot be deleted.`, 400)
    }

    const [groupCount] = await db.select({ val: count() }).from(groups).where(eq(groups.organizationId, orgId))
    if (groupCount.val > 0) {
      return error(`Cannot delete: This organization has ${groupCount.val} group(s) defined. Please delete the organization's groups first.`, 400)
    }

    const [hoCount] = await db.select({ val: count() }).from(headOffices).where(eq(headOffices.organizationId, orgId))
    if (hoCount.val > 0) {
      return error(`Cannot delete: A Head Office record exists for this organization. Please remove it first.`, 400)
    }

    // 2. Tier 2: Auto-Cleanup Non-Critical Metadata/System Data
    // These tables contain logs, settings, and transitive associations that can be safely auto-purged.
    await db.transaction(async (tx) => {
      // System and Audit Logs
      await tx.delete(auditLogs).where(eq(auditLogs.organizationId, orgId))
      await tx.delete(systemLogs).where(eq(systemLogs.organizationId, orgId))
      await tx.delete(groupAuditLogs).where(eq(groupAuditLogs.organizationId, orgId))
      await tx.delete(notifications).where(eq(notifications.organizationId, orgId))
      await tx.delete(sessions).where(eq(sessions.organizationId, orgId))

      // Configuration and Metrics
      await tx.delete(organizationSettings).where(eq(organizationSettings.organizationId, orgId))
      await tx.delete(orgMetrics).where(eq(orgMetrics.organizationId, orgId))

      // Catalog and Inventory Associations
      await tx.delete(inventory).where(eq(inventory.organizationId, orgId))
      await tx.delete(organizationInventory).where(eq(organizationInventory.organizationId, orgId))
      await tx.delete(organizationProducts).where(eq(organizationProducts.organizationId, orgId))

      // Local Product Definitions (categories/products are often org-scoped)
      await tx.delete(skus).where(eq(skus.organizationId, orgId))
      await tx.delete(products).where(eq(products.organizationId, orgId))
      await tx.delete(categories).where(eq(categories.organizationId, orgId))

      // Operational Data
      await tx.delete(suppliers).where(eq(suppliers.organizationId, orgId))
      await tx.delete(budgets).where(eq(budgets.organizationId, orgId))
      await tx.delete(employeeCredentials).where(eq(employeeCredentials.organizationId, orgId))

      // 3. Final Step: Delete the Organization
      await tx.delete(organizations).where(eq(organizations.id, orgId))
    })

    return ok({ ok: true })
  } catch (e: any) {
    console.error("Delete organization failed:", e)

    const errorCode = String(e.code || e.originalError?.code || "")
    const errorMessage = String(e.message || "").toLowerCase()

    // Catch-all for any remaining foreign key constraints
    if (errorCode === "23503" || errorMessage.includes("foreign key") || errorMessage.includes("violates")) {
      return error("Cannot delete: A database dependency (foreign key) is still blocking deletion. Ensure all branches, users, and groups are removed.", 400)
    }

    return error("Failed to delete organization", 500)
  }
}
