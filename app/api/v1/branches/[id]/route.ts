import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { invalidateByPrefix } from "@/lib/cache-utils"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { branches } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err

  const { id } = await props.params
  const scope = await getRequestScope()
  const branchId = parseInt(id)

  try {
    const item = await (scope?.role === "SUPER_ADMIN"
      ? withSuperAdmin((tx) => tx.select().from(branches).where(eq(branches.id, branchId)).limit(1).then(r => r[0]))
      : withTenant(scope as any, (tx) => {
        const cond = [eq(branches.id, branchId), eq(branches.organizationId, scope!.organizationId!)]
        if (scope?.role === "BRANCH_ADMIN" && scope.branchId) cond.push(eq(branches.id, scope.branchId))
        return tx.select().from(branches).where(and(...cond)).limit(1).then(r => r[0])
      }))

    if (!item) return error("Not found", 404)
    return ok({ item })
  } catch (e) {
    return error("Failed to fetch branch", 500)
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err

  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)

  const { id } = await props.params
  const scope = await getRequestScope()
  const branchId = parseInt(id)

  try {
    const patch: any = { updatedAt: new Date() }
    if (body.name !== undefined) patch.name = String(body.name)
    if (body.status !== undefined) {
      const valid = ['active', 'inactive', 'suspended']
      if (!valid.includes(body.status)) return error("Invalid status", 400)
      patch.status = body.status
    }
    if (body.groupId !== undefined) patch.groupId = body.groupId === null ? null : Number(body.groupId)

    const updated = await (scope?.role === "SUPER_ADMIN"
      ? withSuperAdmin((tx) => tx.update(branches).set(patch).where(eq(branches.id, branchId)).returning().then(r => r[0]))
      : withTenant(scope as any, (tx) => tx.update(branches).set(patch).where(and(eq(branches.id, branchId), eq(branches.organizationId, scope!.organizationId!))).returning().then(r => r[0])))


    if (!updated) return error("Branch not found or unauthorized", 404)

    await invalidateByPrefix('branches')
    await invalidateByPrefix('groups')
    return ok({ item: updated })
  } catch (e) {
    return error("Update failed", 400)
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err

  const { id } = await props.params
  const branchId = parseInt(id)

  try {
    const result = await withSuperAdmin(async (tx) => {
      const [existing] = await tx.select().from(branches).where(eq(branches.id, branchId))
      if (!existing) throw new Error("Branch not found")
      if (existing.status === 'inactive') throw new Error("Already inactive")

      return tx.update(branches).set({ status: 'inactive', updatedAt: new Date() }).where(eq(branches.id, branchId)).returning().then(r => r[0])
    })

    await invalidateByPrefix('branches')
    return ok({ message: "Branch deactivated", item: result })
  } catch (e: any) {
    return error(e.message || "Deactivation failed", 400)
  }
}


