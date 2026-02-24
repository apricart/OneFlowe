import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { organizationInventory, globalProducts, organizations, auditLogs, categories } from "@/db/schema"
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm"
import { cascadeOrgDeletion, cascadeOrgStatusChange } from "@/lib/inventory-cascade"
import { validateAssignmentData } from "@/lib/inventory-validation"

// GET /api/v1/admin/organization-assignments - List organization assignments
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get("organizationId")
    const productId = searchParams.get("productId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions = [
      isNull(organizationInventory.deletedAt),
      isNull(globalProducts.deletedAt)
    ]
    if (organizationId) {
      conditions.push(eq(organizationInventory.organizationId, parseInt(organizationId)))
    }
    if (productId) {
      conditions.push(eq(organizationInventory.globalProductId, parseInt(productId)))
    }

    const whereClause = and(...conditions)

    const [items, totalResult] = await Promise.all([
      db.select({
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
        categoryName: categories.name,
        productImageUrl: globalProducts.imageUrl,
        globalStatus: globalProducts.status,
        organizationName: organizations.name,
      })
        .from(organizationInventory)
        .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
        .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
        .leftJoin(organizations, eq(organizationInventory.organizationId, organizations.id))
        .where(whereClause)
        .orderBy(desc(organizationInventory.assignedAt))
        .limit(limit)
        .offset(offset),

      db.select({ count: sql<number>`count(*)` })
        .from(organizationInventory)
        .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
        .where(whereClause),
    ])

    const total = totalResult[0].count

    return NextResponse.json({ items, total, page, limit })
  } catch (error) {
    console.error("Error fetching organization assignments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// POST /api/v1/admin/organization-assignments - Assign products to organization
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    console.log("POST /api/v1/admin/organization-assignments - Request body:", body)

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

    console.log("Parsed data:", { productIds, organizationId, isActive, customName, customPrice, customDescription, customImageUrl })

    let normalizedProductIds: number[] = []
    if (Array.isArray(assignmentOverrides) && assignmentOverrides.length > 0) {
      normalizedProductIds = assignmentOverrides
        .map((entry: any) => parseInt(entry.productId))
        .filter((value: number) => Number.isFinite(value))
    } else if (Array.isArray(productIds) && productIds.length > 0) {
      normalizedProductIds = productIds.map((id: any) => parseInt(id)).filter((value: number) => Number.isFinite(value))
    }

    if (normalizedProductIds.length === 0) {
      console.log("Validation error: Product identifiers are required")
      return NextResponse.json({ error: "Product IDs or detailed assignments are required" }, { status: 400 })
    }
    if (!organizationId) {
      console.log("Validation error: Organization ID is required")
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 })
    }

    // Validate assignment data
    console.log("Validating assignment data for organizationId:", parseInt(organizationId), "productIds:", productIds)
    const validation = await validateAssignmentData({
      organizationId: parseInt(organizationId),
      globalProductId: normalizedProductIds[0], // representative
      userId: (session.user as any).id
    })

    console.log("Validation result:", validation)

    if (!validation.valid) {
      console.log("Validation failed:", validation.errors)
      return NextResponse.json({
        error: validation.errors[0] || "Validation failed",
        details: validation.errors
      }, { status: 400 })
    }

    // Check for existing assignments to avoid duplicates
    const existingAssignments = await db.select({
      globalProductId: organizationInventory.globalProductId,
    })
      .from(organizationInventory)
      .where(
        and(
          eq(organizationInventory.organizationId, parseInt(organizationId)),
          inArray(organizationInventory.globalProductId, normalizedProductIds),
          isNull(organizationInventory.deletedAt)
        )
      )

    // Create a set of existing product IDs for quick lookup
    const existingProductIds = new Set(existingAssignments.map(a => a.globalProductId))
    const unassignedProductIds = productIds.filter((id: string) => !existingProductIds.has(parseInt(id)))

    // If all products are already assigned, return a helpful message
    if (unassignedProductIds.length === 0) {
      return NextResponse.json({
        error: "All selected products are already assigned to this organization",
        alreadyAssigned: productIds.map((id: string) => parseInt(id)),
        unassigned: []
      }, { status: 400 })
    }

    // If some products are already assigned, return partial success with details
    if (unassignedProductIds.length < normalizedProductIds.length) {
      const alreadyAssignedIds = normalizedProductIds.filter(id => existingProductIds.has(id))

      // Create assignments only for unassigned products
      const assignments = unassignedProductIds.map((productId: string) => {
        const override = Array.isArray(assignmentOverrides)
          ? assignmentOverrides.find((entry: any) => parseInt(entry.productId) === parseInt(productId))
          : null
        const resolvedCustomPrice =
          override && override.customPrice !== undefined && override.customPrice !== null
            ? Math.round(parseFloat(override.customPrice) * 100)
            : customPrice
              ? Math.round(parseFloat(customPrice) * 100)
              : null

        return {
          globalProductId: productId,
          organizationId: parseInt(organizationId),
          assignedByUserId: (session.user as any).id,
          isActive: override?.isActive ?? isActive,
          customName: override?.customName ?? customName ?? null,
          customPrice: resolvedCustomPrice,
          customDescription: override?.customDescription ?? customDescription ?? null,
          customImageUrl: override?.customImageUrl ?? customImageUrl ?? null,
        }
      })

      const result = await db.insert(organizationInventory).values(assignments).returning()

      return NextResponse.json({
        message: `Successfully assigned ${assignments.length} products. ${alreadyAssignedIds.length} products were already assigned.`,
        assignments: result,
        alreadyAssigned: alreadyAssignedIds,
        unassigned: unassignedProductIds
      }, { status: 200 })
    }

    // All products are unassigned, proceed with normal assignment
    const assignments = normalizedProductIds.map(productId => {
      const override = Array.isArray(assignmentOverrides)
        ? assignmentOverrides.find((entry: any) => parseInt(entry.productId) === productId)
        : null
      const resolvedCustomPrice =
        override && override.customPrice !== undefined && override.customPrice !== null
          ? Math.round(parseFloat(override.customPrice) * 100)
          : customPrice
            ? Math.round(parseFloat(customPrice) * 100)
            : null

      return {
        globalProductId: productId,
        organizationId: parseInt(organizationId),
        assignedByUserId: (session.user as any).id,
        isActive: override?.isActive ?? isActive,
        customName: override?.customName ?? customName ?? null,
        customPrice: resolvedCustomPrice,
        customDescription: override?.customDescription ?? customDescription ?? null,
        customImageUrl: override?.customImageUrl ?? customImageUrl ?? null,
      }
    })

    const newAssignments = await db.insert(organizationInventory)
      .values(assignments)
      .returning()

    // Log the assignment creation
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "OrganizationAssignment",
      entityId: newAssignments.map(a => a.id).join(','),
      metadata: {
        assignedCount: newAssignments.length,
        organizationId,
        productIds,
        skippedCount: productIds.length - newAssignments.length
      },
    })

    return NextResponse.json({
      message: `${newAssignments.length} products assigned successfully!`,
      assignments: newAssignments,
      skipped: productIds.length - newAssignments.length
    })
  } catch (error: any) {
    console.error("Error creating organization assignments:", error)

    // Handle duplicate-assignment case more gracefully
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "One or more of these products are already assigned to this organization." },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// DELETE /api/v1/admin/organization-assignments - Remove product from organization
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const organizationId = searchParams.get("organizationId")
    const productId = searchParams.get("productId")

    // Support bulk deletion via JSON body: { assignmentIds: number[] }
    let assignmentIdsFromBody: number[] = []
    try {
      const body = await req.json().catch(() => null)
      if (body && Array.isArray(body.assignmentIds)) {
        assignmentIdsFromBody = body.assignmentIds
          .map((v: any) => parseInt(v))
          .filter((v: number) => Number.isFinite(v))
      }
    } catch {
      // Ignore body parse errors – we'll fall back to query-based deletion
    }

    const whereConditions = []
    if (id) {
      whereConditions.push(eq(organizationInventory.id, parseInt(id)))
    }
    if (organizationId) {
      whereConditions.push(eq(organizationInventory.organizationId, parseInt(organizationId)))
    }
    if (productId) {
      whereConditions.push(eq(organizationInventory.globalProductId, parseInt(productId)))
    }
    if (assignmentIdsFromBody.length > 0) {
      whereConditions.push(inArray(organizationInventory.id, assignmentIdsFromBody))
    }

    if (whereConditions.length === 0) {
      return NextResponse.json(
        { error: "Assignment ID, Organization ID, Product ID, or assignmentIds are required" },
        { status: 400 }
      )
    }

    // Find assignments to be deleted
    const assignmentsToDelete = await db
      .select({
        id: organizationInventory.id,
        organizationId: organizationInventory.organizationId,
        globalProductId: organizationInventory.globalProductId,
      })
      .from(organizationInventory)
      .where(and(...whereConditions))

    if (!assignmentsToDelete || assignmentsToDelete.length === 0) {
      return NextResponse.json({ error: "No assignments found" }, { status: 404 })
    }

    // Hard delete each assignment and cascade to branches
    let totalBranchDeletions = 0
    const affectedBranches: number[] = []

    for (const assignment of assignmentsToDelete) {
      // Cascade to branches first
      const cascadeResult = await cascadeOrgDeletion(
        assignment.id,
        (session.user as any).id,
        "SUPER_ADMIN"
      )
      totalBranchDeletions += cascadeResult.deletedCount
      affectedBranches.push(...cascadeResult.affectedBranches)

      // Then hard delete the organization assignment
      await db
        .delete(organizationInventory)
        .where(eq(organizationInventory.id, assignment.id))
    }

    // Log the assignment deletion
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "OrganizationAssignment",
      entityId: id || "bulk",
      metadata: {
        deletedCount: assignmentsToDelete.length,
        branchDeletions: totalBranchDeletions,
        affectedBranches: [...new Set(affectedBranches)],
        organizationId,
        productId
      },
    })

    return NextResponse.json({
      message: "Assignments removed successfully",
      count: assignmentsToDelete.length,
      branchDeletions: totalBranchDeletions
    })
  } catch (error: any) {
    console.error("Error deleting organization assignments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// PUT /api/v1/admin/organization-assignments - Update organization assignment
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const {
      id,
      isActive,
      customName,
      customPrice,
      customDescription,
      customImageUrl
    } = body

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })
    }

    // Check if assignment exists
    const [existingAssignment] = await db.select({
      id: organizationInventory.id,
      isActive: organizationInventory.isActive,
    })
      .from(organizationInventory)
      .where(
        and(
          eq(organizationInventory.id, parseInt(id)),
          isNull(organizationInventory.deletedAt)
        )
      )

    if (!existingAssignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    const updateData: any = {
      updatedAt: new Date()
    }

    if (isActive !== undefined) updateData.isActive = isActive
    if (customName !== undefined) updateData.customName = customName
    if (customPrice !== undefined) updateData.customPrice = customPrice ? Math.round(parseFloat(customPrice) * 100) : null
    if (customDescription !== undefined) updateData.customDescription = customDescription
    if (customImageUrl !== undefined) updateData.customImageUrl = customImageUrl

    // Update the assignment
    const [updatedAssignment] = await db.update(organizationInventory)
      .set(updateData)
      .where(eq(organizationInventory.id, parseInt(id)))
      .returning()

    // If isActive status changed, cascade to branches
    if (isActive !== undefined && isActive !== existingAssignment.isActive) {
      const cascadeResult = await cascadeOrgStatusChange(
        parseInt(id),
        isActive,
        (session.user as any).id,
        "SUPER_ADMIN"
      )

      // Log the cascade update
      await db.insert(auditLogs).values({
        userId: (session.user as any).id,
        action: "CASCADE_UPDATE",
        entity: "OrganizationAssignment",
        entityId: id.toString(),
        metadata: {
          organizationInventoryId: parseInt(id),
          isActive,
          branchUpdates: cascadeResult.updatedCount,
          affectedBranches: cascadeResult.affectedBranches,
          performedByRole: "SUPER_ADMIN"
        },
      })
    }

    // Log the assignment update
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "OrganizationAssignment",
      entityId: id.toString(),
      metadata: {
        updateData,
        performedByRole: "SUPER_ADMIN"
      },
    })

    return NextResponse.json({
      message: "Assignment updated successfully",
      assignment: updatedAssignment
    })
  } catch (error: any) {
    console.error("Error updating organization assignment:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

