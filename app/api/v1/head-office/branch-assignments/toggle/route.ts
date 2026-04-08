import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { branchInventory, branches, groups, auditLogs } from "@/db/schema"
import { eq, and, inArray, isNull } from "drizzle-orm"
import { invalidateByPrefix } from "@/lib/cache-utils"
import { getRequestScope } from "@/lib/auth"

export async function PUT(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope || (scope.role !== "HEAD_OFFICE" && scope.role !== "SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { organizationInventoryId, organizationId, isActive, groupIds } = body

    if (!organizationInventoryId || !organizationId || isActive === undefined) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    if (!groupIds) return NextResponse.json({ error: "groupIds required" }, { status: 400 })

    const orgId = parseInt(organizationId)
    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      let targetBranchIds: number[] = []

      if (groupIds === "all") {
        const orgGroups = await tx.select({ id: groups.id }).from(groups).where(eq(groups.organizationId, orgId))
        if (orgGroups.length > 0) {
          const branchesInGroups = await tx.select({ id: branches.id }).from(branches).where(inArray(branches.groupId, orgGroups.map((g: any) => g.id)))
          targetBranchIds = branchesInGroups.map((b: any) => b.id)
        }
      } else {
        const selected = (Array.isArray(groupIds) ? groupIds : [groupIds]).map(Number)
        const branchesInGroups = await tx.select({ id: branches.id }).from(branches).where(inArray(branches.groupId, selected))
        targetBranchIds = branchesInGroups.map((b: any) => b.id)
      }

      if (targetBranchIds.length === 0) throw new Error("No branches found")

      const updated = await tx.update(branchInventory).set({ isActive, isVisible: isActive, updatedAt: new Date() })
        .where(and(eq(branchInventory.organizationInventoryId, parseInt(organizationInventoryId)), eq(branchInventory.organizationId, orgId), inArray(branchInventory.branchId, targetBranchIds), isNull(branchInventory.deletedAt))).returning()

      await tx.insert(auditLogs).values({
        userId: scope!.userId,
        action: "TOGGLE_GROUP_STATUS",
        entity: "BranchInventory",
        entityId: organizationInventoryId.toString(),
        metadata: { organizationInventoryId, organizationId: orgId, isActive, groupIds, affectedBranches: targetBranchIds, updatedCount: updated.length },
      })

      return { updatedCount: updated.length }
    }

    await invalidateByPrefix('branch-inv')
    return NextResponse.json({ message: `Status updated in ${result.updatedCount} branches`, ...result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope || (scope.role !== "HEAD_OFFICE" && scope.role !== "SUPER_ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const organizationInventoryId = searchParams.get("organizationInventoryId")
    const organizationId = searchParams.get("organizationId")

    if (!organizationInventoryId || !organizationId) return NextResponse.json({ error: "Missing parameters" }, { status: 400 })

    const groupsList = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const assignments = await tx.select({
        branchId: branchInventory.branchId,
        isActive: branchInventory.isActive,
        branchName: branches.name,
        groupId: branches.groupId,
        groupName: groups.name,
      }).from(branchInventory)
        .leftJoin(branches, eq(branchInventory.branchId, branches.id))
        .leftJoin(groups, eq(branches.groupId, groups.id))
        .where(and(eq(branchInventory.organizationInventoryId, parseInt(organizationInventoryId!)), eq(branchInventory.organizationId, parseInt(organizationId!)), isNull(branchInventory.deletedAt)))

      const groupMap = new Map<number, any>()
      for (const a of assignments) {
        if (!a.groupId || !a.groupName) continue
        if (!groupMap.has(a.groupId)) {
          groupMap.set(a.groupId, { groupId: a.groupId, groupName: a.groupName, branches: [], allActive: true, allInactive: true })
        }
        const g = groupMap.get(a.groupId)!
        g.branches.push({ branchId: a.branchId, branchName: a.branchName || "Unknown", isActive: a.isActive })
        if (a.isActive) g.allInactive = false
        else g.allActive = false
      }
      return Array.from(groupMap.values())
    }

    return NextResponse.json({ groups: groupsList })
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

