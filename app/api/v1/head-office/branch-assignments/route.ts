export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { 
  branchInventory, 
  organizationInventory, 
  branches, 
  globalProducts, 
  auditLogs, 
  groups, 
  categories 
} from "@/db/schema"
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm"
import { logInventoryAction } from "@/lib/global-logger"
import { invalidateByPrefix } from "@/lib/cache-utils"

// GET /api/v1/head-office/branch-assignments - List branch assignments
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "HEAD_OFFICE" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      const branchId = searchParams.get("branchId")
      const groupId = searchParams.get("groupId")
      const productId = searchParams.get("productId")
      const page = parseInt(searchParams.get("page") || "1")
      const limit = parseInt(searchParams.get("limit") || "50")
      const offset = (page - 1) * limit

      const conditions = [
        isNull(branchInventory.deletedAt),
        isNull(globalProducts.deletedAt),
      ]

      if (branchId) conditions.push(eq(branchInventory.branchId, parseInt(branchId)))
      if (groupId) conditions.push(eq(branches.groupId, parseInt(groupId)))
      if (productId) conditions.push(eq(organizationInventory.globalProductId, parseInt(productId)))

      const [items, totalResult] = await Promise.all([
        tx.select({
          id: branchInventory.id,
          branchId: branchInventory.branchId,
          organizationId: branchInventory.organizationId,
          organizationInventoryId: branchInventory.organizationInventoryId,
          globalProductId: globalProducts.id,
          isVisible: branchInventory.isVisible,
          isActive: branchInventory.isActive,
          assignedAt: branchInventory.assignedAt,
          updatedAt: branchInventory.updatedAt,
          productName: globalProducts.name,
          productCode: globalProducts.productCode,
          categoryName: categories.name,
          productImageUrl: globalProducts.imageUrl,
          globalStatus: globalProducts.status,
          basePrice: globalProducts.basePrice,
          unit: globalProducts.unit,
          branchName: branches.name,
          customName: organizationInventory.customName,
          customPrice: organizationInventory.customPrice,
          orgIsActive: organizationInventory.isActive,
        })
          .from(branchInventory)
          .leftJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
          .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
          .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
          .leftJoin(branches, eq(branchInventory.branchId, branches.id))
          .where(and(...conditions))
          .orderBy(desc(branchInventory.assignedAt))
          .limit(limit)
          .offset(offset),

        tx.select({ count: sql<number>`count(*)` })
          .from(branchInventory)
          .leftJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
          .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
          .leftJoin(branches, eq(branchInventory.branchId, branches.id))
          .where(and(...conditions)),
      ])

      return { items, total: (totalResult[0] as any).count, page, limit }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error fetching branch assignments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// POST /api/v1/head-office/branch-assignments - Assign products to branches
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "HEAD_OFFICE" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { organizationInventoryIds, branchIds: directBranchIds, groupId, isVisible = true } = body

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      let branchIds: number[] = []
      let groupName: string | null = null

      if (groupId) {
        const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1)
        if (!group) throw new Error("Group not found")
        groupName = group.name
        const groupBranches = await tx.select({ id: branches.id }).from(branches).where(eq(branches.groupId, groupId))
        branchIds = groupBranches.map((b: any) => b.id)
      } else if (directBranchIds?.length > 0) {
        branchIds = directBranchIds
      } else {
        throw new Error("Either groupId or branchIds is required")
      }

      if (branchIds.length === 0) throw new Error("No branches found for assignment")

      const orgItems = await tx.select().from(organizationInventory).where(and(inArray(organizationInventory.id, organizationInventoryIds), isNull(organizationInventory.deletedAt)))
      if (orgItems.length !== organizationInventoryIds.length) throw new Error("Some inventory items not found or access denied")

      const existing = await tx.select().from(branchInventory).where(and(inArray(branchInventory.organizationInventoryId, organizationInventoryIds), inArray(branchInventory.branchId, branchIds)))
      
      const activeKeys = new Set(existing.filter((a: any) => a.deletedAt === null).map((a: any) => `${a.organizationInventoryId}-${a.branchId}`))
      const softDeleted = existing.filter((a: any) => a.deletedAt !== null)

      const toInsert: any[] = []
      const toRestore: number[] = []

      for (const invId of organizationInventoryIds) {
        const orgItem = orgItems.find((i: any) => i.id === invId)
        for (const bId of branchIds) {
          if (activeKeys.has(`${invId}-${bId}`)) continue
          const sd = softDeleted.find((s: any) => s.organizationInventoryId === invId && s.branchId === bId)
          if (sd) toRestore.push(sd.id)
          else toInsert.push({ branchId: bId, organizationId: orgItem.organizationId, organizationInventoryId: invId, assignedByUserId: user.id, isVisible, isActive: orgItem.isActive })
        }
      }

      const newAssignments: any[] = []
      if (toRestore.length > 0) {
        const restored = await tx.update(branchInventory).set({ deletedAt: null, assignedByUserId: user.id, updatedAt: new Date() }).where(inArray(branchInventory.id, toRestore)).returning()
        newAssignments.push(...restored)
      }
      if (toInsert.length > 0) {
        const inserted = await tx.insert(branchInventory).values(toInsert).returning()
        newAssignments.push(...inserted)
      }

      if (newAssignments.length > 0) {
        await tx.insert(auditLogs).values({
          userId: user.id,
          action: "CREATE",
          entity: "BranchAssignment",
          entityId: newAssignments.map(a => a.id).join(','),
          metadata: { assignedCount: newAssignments.length, groupId, groupName, branchIds },
        })

        logInventoryAction('ASSIGN', 'BRANCH_ASSIGNMENT', user, {
          organizationId: newAssignments[0].organizationId,
          assignmentIds: newAssignments.map(a => a.id),
          count: newAssignments.length,
          metadata: { branchIds, groupId }
        })
      }

      return { newAssignments, groupName, branchCount: branchIds.length }
    })

    await invalidateByPrefix('branch-inv')
    return NextResponse.json({
      message: (result as any).groupName 
        ? `${(result as any).newAssignments.length} products assigned to group "${(result as any).groupName}" successfully!` 
        : `${(result as any).newAssignments.length} products assigned to branches successfully!`,
      assignments: (result as any).newAssignments,
      branchCount: (result as any).branchCount
    })
  } catch (error: any) {
    console.error("Error creating branch assignments:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}

// DELETE /api/v1/head-office/branch-assignments - Remove product from branch
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "HEAD_OFFICE" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const branchId = searchParams.get("branchId")
    const productId = searchParams.get("productId")

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      const conditions = [isNull(branchInventory.deletedAt)]
      if (id) conditions.push(eq(branchInventory.id, parseInt(id)))
      if (branchId) conditions.push(eq(branchInventory.branchId, parseInt(branchId)))
      
      const assignmentsToDelete = await tx.select({ id: branchInventory.id, organizationId: branchInventory.organizationId })
        .from(branchInventory)
        .leftJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
        .where(productId ? and(...conditions, eq(organizationInventory.globalProductId, parseInt(productId))) : and(...conditions))

      if (assignmentsToDelete.length === 0) throw new Error("No active assignments found")

      const ids = assignmentsToDelete.map((a: any) => a.id)
      await tx.update(branchInventory).set({ deletedAt: new Date(), updatedAt: new Date() }).where(inArray(branchInventory.id, ids))

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "DELETE",
        entity: "BranchAssignment",
        entityId: id || "bulk",
        metadata: { deletedCount: ids.length, branchId, productId },
      })

      logInventoryAction('REMOVE', 'BRANCH_ASSIGNMENT', user, {
        organizationId: assignmentsToDelete[0].organizationId,
        assignmentIds: ids,
        count: ids.length,
        metadata: { productId }
      })

      return { count: ids.length }
    })

    await invalidateByPrefix('branch-inv')
    return NextResponse.json({ message: "Branch assignments removed successfully", count: (result as any).count })
  } catch (error: any) {
    console.error("Error deleting branch assignments:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}

// PUT /api/v1/head-office/branch-assignments - Update settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "HEAD_OFFICE" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { id, isVisible, isActive } = body
    if (!id) return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      const updateData: any = { updatedAt: new Date() }
      if (isVisible !== undefined) updateData.isVisible = isVisible
      if (isActive !== undefined) updateData.isActive = isActive

      const [updated] = await tx.update(branchInventory)
        .set(updateData)
        .where(and(eq(branchInventory.id, parseInt(id)), isNull(branchInventory.deletedAt)))
        .returning()

      if (!updated) throw new Error("Assignment not found or access denied")

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "UPDATE",
        entity: "BranchAssignment",
        entityId: id.toString(),
        metadata: { updateData },
      })

      return updated
    })

    return NextResponse.json({ message: "Branch assignment updated successfully", assignment: result })
  } catch (error: any) {
    console.error("Error updating branch assignment:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
