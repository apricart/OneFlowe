import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { invalidateByPrefix } from "@/lib/cache-utils"
import { db } from "@/lib/db"
import { branches } from "@/db/schema"
import { eq } from "drizzle-orm"
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

    // Invalidate branches and groups cache so GET returns fresh data immediately
    await invalidateByPrefix('branches')
    await invalidateByPrefix('groups')

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

    // Already inactive
    if (existing.status === 'inactive') {
      return error("Branch is already inactive", 400)
    }

    // Soft-delete: mark as inactive instead of hard-deleting
    // All historical data (budgets, orders, audit logs, etc.) is preserved
    const [updated] = await db.update(branches)
      .set({
        status: 'inactive',
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branchId))
      .returning()

    // Invalidate caches
    await invalidateByPrefix('branches')

    return ok({
      ok: true,
      message: "Branch deactivated successfully. All historical data has been preserved.",
      item: updated
    })

  } catch (e: any) {
    console.error("Delete branch failed:", e)
    return error("Failed to deactivate branch", 500)
  }
}

