import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { invalidateByPrefix } from "@/lib/cache-utils"
import { db } from "@/lib/db"
import { branches, users, orders, branchProducts, branchInventory, employeeCredentials, suppliers, budgets, restockRequests, inventory, systemLogs, notifications, auditLogs } from "@/db/schema"
import { eq, count, and, isNull } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(
  _: Request,
  props: { params: Promise<{ id: string }> }
) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const params = await props.params
  const { id } = params
  const [item] = await db.select().from(branches).where(eq(branches.id, Number(id)))
  if (!item) return error("Not found", 404)

  // BOLA Protection: verify user has access to this branch's organization
  const { verifyResourceAccess } = await import("@/lib/auth")
  const hasAccess = await verifyResourceAccess(item.organizationId, item.id)
  if (!hasAccess) return error("Forbidden: You do not have access to this branch", 403)

  return ok({ item })
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  try {
    const params = await props.params
    const { id } = params

    const scope = await getRequestScope()
    if (scope?.role === "HEAD_OFFICE") {
      const [branch] = await db
        .select({ organizationId: branches.organizationId })
        .from(branches)
        .where(eq(branches.id, Number(id)))
      if (!branch) return error("Not found", 404)
      if (!scope.organizationId || scope.organizationId !== branch.organizationId) {
        return error("Forbidden", 403)
      }
    }

    const patch: any = {}
    if (body.name !== undefined) patch.name = String(body.name)
    if (body.status !== undefined) {
      const normalized = String(body.status).toLowerCase()
      const validStatuses = ['active', 'inactive', 'suspended']
      if (!validStatuses.includes(normalized)) {
        return error(`Status must be one of: ${validStatuses.join(', ')}`, 400)
      }
      patch.status = normalized
    }
    if (body.groupId !== undefined) patch.groupId = body.groupId === null ? null : Number(body.groupId)
    patch.updatedAt = new Date()
    const [item] = await db.update(branches).set(patch).where(eq(branches.id, Number(id))).returning()

    // Invalidate branches cache so GET returns fresh data immediately
    await invalidateByPrefix('branches')

    return ok({ item })
  } catch (e: any) {
    console.error("Update branch failed:", e)
    return error("Update failed", 400)
  }
}

export async function DELETE(
  _: Request,
  props: { params: Promise<{ id: string }> }
) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const params = await props.params
  const { id } = params
  const branchId = Number(id)

  try {
    // 0. Check if exists
    const [existing] = await db.select().from(branches).where(eq(branches.id, branchId))
    if (!existing) return error("Branch not found", 404)

    // 1. Dependency Checks - Block deletion if critical data exists

    // Check for users assigned to this branch (ignore soft-deleted users)
    const [activeUserCount] = await db.select({ val: count() }).from(users).where(
      and(
        eq(users.branchId, branchId),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    )

    if (activeUserCount.val > 0) {
      return error(`Cannot delete: This branch has ${activeUserCount.val} active user(s) assigned. Please remove or deactivate every active user before deleting the branch.`, 400)
    }

    // Check for orders
    const [orderCount] = await db.select({ val: count() }).from(orders).where(eq(orders.branchId, branchId))
    if (orderCount.val > 0) {
      return error(`Cannot delete: Historical order records were found. Branches with financial transaction history cannot be deleted.`, 400)
    }

    // Check for employee credentials
    const [credsCount] = await db.select({ val: count() }).from(employeeCredentials).where(eq(employeeCredentials.branchId, branchId))
    if (credsCount.val > 0 && existing.status === 'active') {
      return error(`Cannot delete: This branch is active and has employee portal credentials. Please deactivate the branch or remove them first.`, 400)
    }

    // Check for inventory/products assigned
    const [invCount] = await db.select({ val: count() }).from(branchInventory).where(eq(branchInventory.branchId, branchId))
    if (invCount.val > 0 && existing.status === 'active') {
      return error(`Cannot delete: This branch is active and has assigned inventory. Please deactivate the branch or unassign products first.`, 400)
    }

    const [prodCount] = await db.select({ val: count() }).from(branchProducts).where(eq(branchProducts.branchId, branchId))
    if (prodCount.val > 0 && existing.status === 'active') {
      return error(`Cannot delete: This branch is active and has product settings. Please deactivate the branch or unassign products first.`, 400)
    }

    // Check for suppliers
    const [supplierCount] = await db.select({ val: count() }).from(suppliers).where(eq(suppliers.branchId, branchId))
    if (supplierCount.val > 0 && existing.status === 'active') {
      return error(`Cannot delete: This branch is active and has ${supplierCount.val} supplier record(s). Please deactivate the branch first.`, 400)
    }

    // Check for restock requests
    const [restockCount] = await db.select({ val: count() }).from(restockRequests).where(eq(restockRequests.branchId, branchId))
    if (restockCount.val > 0 && existing.status === 'active') {
      return error(`Cannot delete: This branch is active and has restock requests. Please deactivate the branch first.`, 400)
    }

    // 2. Cascade Deletions - Clean up related data that can be safely deleted
    // (We only reach here if it's inactive OR no critical data exists)

    // Auto-cleanup users assignments (set to null)
    await db.update(users).set({ branchId: null }).where(eq(users.branchId, branchId))

    // Clear admin user ID from branch to avoid any lingering refs
    await db.update(branches).set({ adminUserId: null }).where(eq(branches.id, branchId))

    await db.delete(employeeCredentials).where(eq(employeeCredentials.branchId, branchId))
    await db.delete(branchInventory).where(eq(branchInventory.branchId, branchId))
    await db.delete(branchProducts).where(eq(branchProducts.branchId, branchId))
    await db.delete(suppliers).where(eq(suppliers.branchId, branchId))
    await db.delete(restockRequests).where(eq(restockRequests.branchId, branchId))
    // Delete budget records (budgets are not critical data and can be recreated)
    await db.delete(budgets).where(eq(budgets.branchId, branchId))

    // Delete system logs, audit logs, and notifications (historical/non-critical data)
    await db.delete(systemLogs).where(eq(systemLogs.branchId, branchId))
    await db.delete(auditLogs).where(eq(auditLogs.branchId, branchId))
    await db.delete(notifications).where(eq(notifications.branchId, branchId))

    // Delete legacy inventory records (if any exist - this is an old table)
    await db.delete(inventory).where(eq(inventory.branchId, branchId))

    // 3. Delete the branch
    await db.delete(branches).where(eq(branches.id, branchId))

    // 4. Invalidate caches
    await invalidateByPrefix('branches')

    return ok({ ok: true })

  } catch (e: any) {
    console.error("Delete branch failed:", e)
    return error("Failed to delete branch", 500)
  }
}
