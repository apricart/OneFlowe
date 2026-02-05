import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { branches, users, orders, branchProducts, branchInventory, employeeCredentials, suppliers, budgets, restockRequests } from "@/db/schema"
import { eq, count } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { id } = await params
  const [item] = await db.select().from(branches).where(eq(branches.id, Number(id)))
  if (!item) return error("Not found", 404)
  return ok({ item })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  try {
    const { id } = await params

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
    if (body.code !== undefined) patch.code = String(body.code)
    if (body.status !== undefined) patch.status = String(body.status)
    if (body.groupId !== undefined) patch.groupId = body.groupId === null ? null : Number(body.groupId)
    const [item] = await db.update(branches).set(patch).where(eq(branches.id, Number(id))).returning()
    return ok({ item })
  } catch (e: any) {
    return error(e?.message || "Update failed", 400)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  const branchId = Number(id)

  try {
    // 0. Check if exists
    const [existing] = await db.select().from(branches).where(eq(branches.id, branchId))
    if (!existing) return error("Branch not found", 404)

    // 1. Dependency Checks - Block deletion if critical data exists

    // Check for users assigned to this branch
    const [userCount] = await db.select({ val: count() }).from(users).where(eq(users.branchId, branchId))
    if (userCount.val > 0) {
      return error(`Cannot delete: This branch has ${userCount.val} user(s) assigned. Please remove or reassign users first.`, 400)
    }

    // Check for orders
    const [orderCount] = await db.select({ val: count() }).from(orders).where(eq(orders.branchId, branchId))
    if (orderCount.val > 0) {
      return error(`Cannot delete: Historical order records were found. Branches with financial transaction history cannot be deleted.`, 400)
    }

    // Check for employee credentials
    const [credsCount] = await db.select({ val: count() }).from(employeeCredentials).where(eq(employeeCredentials.branchId, branchId))
    if (credsCount.val > 0) {
      return error(`Cannot delete: Active employee portal credentials found. Remove them first.`, 400)
    }

    // Check for inventory/products assigned
    const [invCount] = await db.select({ val: count() }).from(branchInventory).where(eq(branchInventory.branchId, branchId))
    if (invCount.val > 0) {
      return error(`Cannot delete: This branch has assigned inventory. Please unassign products first.`, 400)
    }

    const [prodCount] = await db.select({ val: count() }).from(branchProducts).where(eq(branchProducts.branchId, branchId))
    if (prodCount.val > 0) {
      return error(`Cannot delete: This branch has product settings configured. Please unassign products first.`, 400)
    }

    // Check for suppliers or budgets
    const [supplierCount] = await db.select({ val: count() }).from(suppliers).where(eq(suppliers.branchId, branchId))
    if (supplierCount.val > 0) {
      return error(`Cannot delete: This branch has ${supplierCount.val} supplier record(s).`, 400)
    }

    const [budgetCount] = await db.select({ val: count() }).from(budgets).where(eq(budgets.branchId, branchId))
    if (budgetCount.val > 0) {
      return error(`Cannot delete: This branch has budget records.`, 400)
    }

    // Check for restock requests
    const [restockCount] = await db.select({ val: count() }).from(restockRequests).where(eq(restockRequests.branchId, branchId))
    if (restockCount.val > 0) {
      return error(`Cannot delete: This branch has pending or historical restock requests.`, 400)
    }

    // If all clear, delete
    await db.delete(branches).where(eq(branches.id, branchId))
    return ok({ ok: true })

  } catch (e: any) {
    console.error("Delete branch failed:", e)
    return error("Failed to delete branch: " + (e.message || "Unknown error"), 500)
  }
}
