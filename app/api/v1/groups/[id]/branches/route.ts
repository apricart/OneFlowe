export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { groups, branches, groupAuditLogs, branchInventory } from "@/db/schema"
import { eq, inArray, and, sql, isNull, count } from "drizzle-orm"
import { invalidateByPrefix } from "@/lib/cache-utils"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const groupId = parseInt(id)
    const result = await (scope.role === "SUPER_ADMIN"
      ? withSuperAdmin((tx) => tx.select().from(branches).where(eq(branches.groupId, groupId)))
      : withTenant(scope as any, (tx) => tx.select().from(branches).where(and(eq(branches.groupId, groupId), eq(branches.organizationId, scope.organizationId!)))))

    return NextResponse.json({ branches: result })
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const scope = await getRequestScope()
    if (!scope || (scope.role !== "SUPER_ADMIN" && scope.role !== "HEAD_OFFICE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const groupId = parseInt(id)
    const body = await req.json()
    const { branchIds, newlyAddedBranchIds: clientNewIds } = body

    if (!Array.isArray(branchIds)) return NextResponse.json({ error: "branchIds array required" }, { status: 400 })

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1)
      if (!group) throw new Error("Group not found")

      // Product Protection: Branches being removed must not have active products
      const currentBranches = await tx.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.groupId, groupId))
      const removing = currentBranches.filter((b: any) => !branchIds.includes(b.id)).map((b: any) => b.id)

      if (removing.length > 0) {
        const withProducts = await tx.select({ branchName: branches.name, pCount: count(branchInventory.id) })
          .from(branchInventory).innerJoin(branches, eq(branchInventory.branchId, branches.id))
          .where(and(inArray(branchInventory.branchId, removing), isNull(branchInventory.deletedAt), eq(branchInventory.isActive, true)))
          .groupBy(branches.name)
        if (withProducts.length > 0) {
          throw new Error(`Cannot remove branches with products: ${withProducts.map((b: any) => b.branchName).join(", ")}`)
        }
      }

      const newlyAdded = Array.isArray(clientNewIds) ? clientNewIds : branchIds.filter((id: number) => !currentBranches.map((b: any) => b.id).includes(id))

      // Validation: Branch exclusivity and ownership
      if (branchIds.length > 0) {
        const conflict = await tx.select().from(branches).where(and(inArray(branches.id, branchIds), sql`${branches.groupId} IS NOT NULL`, sql`${branches.groupId} != ${groupId}`))
        if (conflict.length > 0) throw new Error(`Branches already assigned: ${conflict.map((b: any) => b.name).join(", ")}`)

        const invalid = await tx.select().from(branches).where(and(inArray(branches.id, branchIds), sql`${branches.organizationId} != ${group.organizationId}`))
        if (invalid.length > 0) throw new Error("Unauthorized: Branch ownership mismatch")
      }

      // Reassign branches
      await tx.update(branches).set({ groupId: null }).where(eq(branches.groupId, groupId))
      let assignedCount = 0
      if (branchIds.length > 0) {
        const upd = await tx.update(branches).set({ groupId }).where(and(inArray(branches.id, branchIds), eq(branches.organizationId, group.organizationId)))
        assignedCount = upd.rowCount || 0
      }

      // Auto-assign group products to new branches
      if (newlyAdded.length > 0 && currentBranches.length > 0) {
        const groupProducts = await tx.select({ orgInvId: branchInventory.organizationInventoryId, orgId: branchInventory.organizationId })
          .from(branchInventory).where(and(inArray(branchInventory.branchId, currentBranches.map((b: any) => b.id)), isNull(branchInventory.deletedAt), eq(branchInventory.isActive, true)))

        const uniqueProds = Array.from(new Map(groupProducts.map((p: any) => [p.orgInvId, p])).values())

        if (uniqueProds.length > 0) {
          for (const nbId of newlyAdded) {
            const existing = await tx.select().from(branchInventory).where(and(eq(branchInventory.branchId, nbId), inArray(branchInventory.organizationInventoryId, uniqueProds.map((p: any) => p.orgInvId))))
            const active = new Set(existing.filter((a: any) => !a.deletedAt).map((a: any) => a.organizationInventoryId))
            const softDeleted = existing.filter((a: any) => a.deletedAt).map((a: any) => ({ id: a.id, orgInvId: a.organizationInventoryId }))

            const toRestore = softDeleted.filter((s: any) => !active.has(s.orgInvId)).map((s: any) => s.id)
            const restoredInvIds = new Set(softDeleted.filter((s: any) => toRestore.includes(s.id)).map((s: any) => s.orgInvId))
            const toInsert = uniqueProds.filter((p: any) => !active.has(p.orgInvId) && !restoredInvIds.has(p.orgInvId))
              .map((p: any) => ({ branchId: nbId, organizationId: p.orgId, organizationInventoryId: p.orgInvId, assignedByUserId: scope!.userId, isVisible: true, isActive: true }))

            if (toRestore.length > 0) await tx.update(branchInventory).set({ deletedAt: null, isActive: true, isVisible: true, updatedAt: new Date() }).where(inArray(branchInventory.id, toRestore))
            if (toInsert.length > 0) await tx.insert(branchInventory).values(toInsert)
          }
        }
      }

      await tx.update(groups).set({ status: assignedCount > 0 ? "connected" : "not connected", updatedAt: new Date() }).where(eq(groups.id, groupId))

      await tx.insert(groupAuditLogs).values({
        organizationId: group.organizationId,
        groupId,
        action: "ASSIGN_BRANCHES",
        performedByUserId: scope!.userId,
        performedByRole: scope!.role,
        metadata: { branchIds, newlyAdded, autoAssigned: newlyAdded.length > 0 },
      })


      return { newlyAdded }
    }

    await invalidateByPrefix('group')
    await invalidateByPrefix('branches')
    return NextResponse.json({ message: "Assignments updated", ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 400 })
  }
}

