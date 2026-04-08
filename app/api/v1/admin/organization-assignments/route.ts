import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin } from "@/lib/db"
import { organizationInventory, globalProducts, organizations, auditLogs, categories } from "@/db/schema"
import { eq, and, desc, sql, inArray, isNull, or, ilike, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { cascadeOrgDeletion, cascadeOrgStatusChange } from "@/lib/inventory-cascade"
import { validateAssignmentData } from "@/lib/inventory-validation"
import { invalidateByPrefix } from "@/lib/cache-utils"

// GET /api/v1/admin/organization-assignments - List organization assignments
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get("organizationId")
    const productId = searchParams.get("productId")
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const subCategory = searchParams.get("subCategory")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const result = await withSuperAdmin(async (tx: any) => {
      const conditions: (SQL | undefined)[] = [
        isNull(organizationInventory.deletedAt),
        isNull(globalProducts.deletedAt)
      ]

      if (organizationId) conditions.push(eq(organizationInventory.organizationId, parseInt(organizationId)))
      if (productId) conditions.push(eq(organizationInventory.globalProductId, parseInt(productId)))
      if (search) {
        conditions.push(or(
          ilike(globalProducts.name, `%${search}%`),
          ilike(globalProducts.productCode, `%${search}%`)
        ))
      }

      if (category && category !== 'all') {
        const catId = parseInt(category)
        const [catInfo] = await tx.select({
          id: categories.id,
          parentId: categories.parentId
        }).from(categories).where(eq(categories.id, catId)).limit(1)

        if (catInfo) {
          if (catInfo.parentId === null) {
            const subCats = await tx.select({ id: categories.id }).from(categories).where(eq(categories.parentId, catId))
            const subCatIds = subCats.map((sc: any) => sc.id)
            if (subCatIds.length > 0) conditions.push(inArray(globalProducts.categoryId, subCatIds))
            else conditions.push(eq(globalProducts.categoryId, -1))
          } else {
            conditions.push(eq(globalProducts.categoryId, catId))
          }
        }
      }

      if (subCategory && subCategory !== 'all') {
        conditions.push(eq(globalProducts.categoryId, parseInt(subCategory)))
      }

      const whereClause = and(...conditions.filter(Boolean) as SQL[])
      const subCategories = alias(categories, "subCategories")
      const parentCategories = alias(categories, "parentCategories")

      const [items, totalResult] = await Promise.all([
        tx.select({
          id: organizationInventory.id,
          organizationId: organizationInventory.organizationId,
          globalProductId: organizationInventory.globalProductId,
          isActive: organizationInventory.isActive,
          customName: organizationInventory.customName,
          customPrice: organizationInventory.customPrice,
          customDescription: organizationInventory.customDescription,
          customImageUrl: organizationInventory.customImageUrl,
          assignedAt: organizationInventory.assignedAt,
          productName: globalProducts.name,
          productCode: globalProducts.productCode,
          categoryName: subCategories.name,
          parentCategoryName: parentCategories.name,
          productImageUrl: globalProducts.imageUrl,
          globalStatus: globalProducts.status,
          organizationName: organizations.name,
        })
          .from(organizationInventory)
          .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
          .leftJoin(subCategories, eq(globalProducts.categoryId, subCategories.id))
          .leftJoin(parentCategories, eq(subCategories.parentId, parentCategories.id))
          .leftJoin(organizations, eq(organizationInventory.organizationId, organizations.id))
          .where(whereClause)
          .orderBy(desc(organizationInventory.assignedAt))
          .limit(limit)
          .offset(offset),
        tx.select({ count: sql<number>`count(*)` })
          .from(organizationInventory)
          .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
          .where(whereClause),
      ])

      return { items, total: Number(totalResult[0]?.count || 0) }
    })

    return NextResponse.json({ ...result, page, limit })
  } catch (error) {
    console.error("Error fetching organization assignments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// POST /api/v1/admin/organization-assignments - Assign products to organization
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const {
      productIds,
      assignments: assignmentOverrides,
      organizationId,
      isActive = true,
      customName,
      customPrice,
      customDescription,
      customImageUrl,
    } = body

    let normalizedProductIds: number[] = []
    if (Array.isArray(assignmentOverrides) && assignmentOverrides.length > 0) {
      normalizedProductIds = assignmentOverrides.map((entry: any) => parseInt(entry.productId)).filter(Number.isFinite)
    } else if (Array.isArray(productIds) && productIds.length > 0) {
      normalizedProductIds = productIds.map((id: any) => parseInt(id)).filter(Number.isFinite)
    }

    if (normalizedProductIds.length === 0 || !organizationId) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
    }

    const result = await withSuperAdmin(async (tx: any) => {
      // Validate
      const validation = await validateAssignmentData({
        organizationId: parseInt(organizationId),
        globalProductId: normalizedProductIds[0],
        userId: user.id
      }, tx)

      if (!validation.valid) throw new Error(validation.errors[0] || "Validation failed")

      const existingAssignments = await tx.select({ globalProductId: organizationInventory.globalProductId })
        .from(organizationInventory)
        .where(and(
          eq(organizationInventory.organizationId, parseInt(organizationId)),
          inArray(organizationInventory.globalProductId, normalizedProductIds),
          isNull(organizationInventory.deletedAt)
        ))

      const existingProductIds = new Set(existingAssignments.map((a: any) => a.globalProductId))
      const unassignedProductIds = normalizedProductIds.filter(id => !existingProductIds.has(id))

      if (unassignedProductIds.length === 0) throw new Error("All products are already assigned")

      const assignments = unassignedProductIds.map((productId: number) => {
        const override = Array.isArray(assignmentOverrides) ? assignmentOverrides.find((o: any) => parseInt(o.productId) === productId) : null
        const resolvedCustomPrice = override?.customPrice != null ? Math.round(parseFloat(override.customPrice) * 100) : (customPrice ? Math.round(parseFloat(customPrice) * 100) : null)

        return {
          globalProductId: productId,
          organizationId: parseInt(organizationId),
          assignedByUserId: user.id,
          isActive: override?.isActive ?? isActive,
          customName: override?.customName ?? customName ?? null,
          customPrice: resolvedCustomPrice,
          customDescription: override?.customDescription ?? customDescription ?? null,
          customImageUrl: override?.customImageUrl ?? customImageUrl ?? null,
        }
      })

      const newAssignments = await tx.insert(organizationInventory).values(assignments).returning()

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "CREATE",
        entity: "OrganizationAssignment",
        entityId: newAssignments.map((a: any) => a.id).join(','),
        metadata: { organizationId, assignedCount: newAssignments.length },
      })

      return { message: `${newAssignments.length} products assigned!`, assignments: newAssignments }
    })

    await invalidateByPrefix('org-inv')
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error creating assignments:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 400 })
  }
}

// DELETE /api/v1/admin/organization-assignments - Remove product from organization
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const organizationId = searchParams.get("organizationId")
    const productId = searchParams.get("productId")

    const body = await req.json().catch(() => null)
    const assignmentIdsFromParams = id ? [parseInt(id)] : []
    const assignmentIdsFromBody = Array.isArray(body?.assignmentIds) ? body.assignmentIds.map((v: any) => parseInt(v)).filter(Number.isFinite) : []
    const allAssignmentIds = [...assignmentIdsFromParams, ...assignmentIdsFromBody]

    const result = await withSuperAdmin(async (tx: any) => {
      const conditions: (SQL | undefined)[] = []
      if (allAssignmentIds.length > 0) conditions.push(inArray(organizationInventory.id, allAssignmentIds))
      if (organizationId) conditions.push(eq(organizationInventory.organizationId, parseInt(organizationId)))
      if (productId) conditions.push(eq(organizationInventory.globalProductId, parseInt(productId)))

      if (conditions.length === 0) throw new Error("Missing parameters")

      const assignmentsToDelete = await tx.select().from(organizationInventory).where(and(...conditions.filter(Boolean) as SQL[]))
      if (assignmentsToDelete.length === 0) throw new Error("No assignments found")

      let totalBranchDeletions = 0
      for (const assignment of assignmentsToDelete) {
        const cascadeResult = await cascadeOrgDeletion(assignment.id, user.id, "SUPER_ADMIN", tx)
        totalBranchDeletions += cascadeResult.deletedCount
        await tx.delete(organizationInventory).where(eq(organizationInventory.id, assignment.id))
      }

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "DELETE",
        entity: "OrganizationAssignment",
        entityId: allAssignmentIds.join(',') || "bulk",
        metadata: { deletedCount: assignmentsToDelete.length, branchDeletions: totalBranchDeletions },
      })

      return { count: assignmentsToDelete.length, branchDeletions: totalBranchDeletions }
    })

    await invalidateByPrefix('org-inv')
    await invalidateByPrefix('branch-inv')
    return NextResponse.json({ message: "Assignments removed", ...result })
  } catch (error: any) {
    console.error("Error deleting assignments:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 400 })
  }
}

// PUT /api/v1/admin/organization-assignments - Update organization assignment
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { id, isActive, customName, customPrice, customDescription, customImageUrl } = body

    if (!id) return NextResponse.json({ error: "Assignment ID required" }, { status: 400 })

    const result = await withSuperAdmin(async (tx: any) => {
      const [existing] = await tx.select().from(organizationInventory).where(and(eq(organizationInventory.id, parseInt(id)), isNull(organizationInventory.deletedAt)))
      if (!existing) throw new Error("Assignment not found")

      const updateData: any = { updatedAt: new Date() }
      if (isActive !== undefined) updateData.isActive = isActive
      if (customName !== undefined) updateData.customName = customName
      if (customPrice !== undefined) updateData.customPrice = customPrice ? Math.round(parseFloat(customPrice) * 100) : null
      if (customDescription !== undefined) updateData.customDescription = customDescription
      if (customImageUrl !== undefined) updateData.customImageUrl = customImageUrl

      const [updated] = await tx.update(organizationInventory).set(updateData).where(eq(organizationInventory.id, parseInt(id))).returning()

      if (isActive !== undefined && isActive !== existing.isActive) {
        const cascadeResult = await cascadeOrgStatusChange(parseInt(id), isActive, user.id, "SUPER_ADMIN", tx)
        await tx.insert(auditLogs).values({
          userId: user.id,
          action: "CASCADE_UPDATE",
          entity: "OrganizationAssignment",
          entityId: id.toString(),
          metadata: { isActive, branchUpdates: cascadeResult.updatedCount },
        })
      }

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "UPDATE",
        entity: "OrganizationAssignment",
        entityId: id.toString(),
        metadata: { updateData },
      })

      return updated
    })

    await invalidateByPrefix('org-inv')
    if (isActive !== undefined) await invalidateByPrefix('branch-inv')
    return NextResponse.json({ message: "Assignment updated", assignment: result })
  } catch (error: any) {
    console.error("Error updating assignment:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 400 })
  }
}


