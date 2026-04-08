import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { groups, branches, branchInventory, groupAuditLogs } from "@/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { invalidateByPrefix } from "@/lib/cache-utils"
import { getRequestScope } from "@/lib/auth"

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const scope = await getRequestScope()
    if (!scope || (scope.role !== "SUPER_ADMIN" && scope.role !== "HEAD_OFFICE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const groupId = parseInt(id)
    const body = await req.json()
    const { branchId } = body

    if (!branchId || typeof branchId !== "number") return NextResponse.json({ error: "branchId (number) required" }, { status: 400 })

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1)
      if (!group) throw new Error("Group not found")

      const [branch] = await tx.select().from(branches).where(and(eq(branches.id, branchId), eq(branches.groupId, groupId))).limit(1)
      if (!branch) throw new Error("Branch not found in this group")

      const now = new Date()
      const upd = await tx.update(branchInventory).set({ deletedAt: now, isActive: false, updatedAt: now })
        .where(and(eq(branchInventory.branchId, branchId), eq(branchInventory.organizationId, group.organizationId), isNull(branchInventory.deletedAt)))

      const cleanedCount = upd.rowCount || 0

      await tx.insert(groupAuditLogs).values({
        organizationId: group.organizationId,
        groupId,
        action: "CLEAN_BRANCH_PRODUCTS",
        performedByUserId: scope!.userId,
        performedByRole: scope!.role,
        metadata: { branchId, branchName: branch.name, cleanedCount },
      })

      return { message: `Cleaned ${cleanedCount} products from "${branch.name}"`, cleanedCount }
    }

    await invalidateByPrefix('group')
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 400 })
  }
}

