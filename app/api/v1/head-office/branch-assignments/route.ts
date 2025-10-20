import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { branchInventory, organizationInventory, branches, globalProducts, auditLogs } from "@/db/schema"
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm"

// GET /api/v1/head-office/branch-assignments - List branch assignments
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "HEAD_OFFICE" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Head Office or Super Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    
    // Get organization ID from session context (should be set by middleware)
    // For Super Admin, get from query params if available
    let organizationId = (session.user as any).organizationId
    if (userRole === "SUPER_ADMIN") {
      const orgIdParam = searchParams.get("organizationId")
      if (orgIdParam) {
        organizationId = parseInt(orgIdParam)
      }
    }
    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found in session" }, { status: 400 })
    }

    const branchId = searchParams.get("branchId")
    const productId = searchParams.get("productId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions = [
      eq(branchInventory.organizationId, parseInt(organizationId)),
      isNull(branchInventory.deletedAt)
    ]
    
    if (branchId) {
      conditions.push(eq(branchInventory.branchId, parseInt(branchId)))
    }
    // productId refers to global product; filter via organizationInventory.globalProductId after join

    const whereClause = and(...conditions)

    const [items, totalResult] = await Promise.all([
      db.select({
        id: branchInventory.id,
        branchId: branchInventory.branchId,
        organizationId: branchInventory.organizationId,
        organizationInventoryId: branchInventory.organizationInventoryId,
        // derive globalProductId from organizationInventory/globalProducts
        globalProductId: globalProducts.id,
        isVisible: branchInventory.isVisible,
        isActive: branchInventory.isActive,
        stockQuantity: branchInventory.stockQuantity,
        reorderThreshold: branchInventory.reorderThreshold,
        assignedAt: branchInventory.assignedAt,
        updatedAt: branchInventory.updatedAt,
        // Related data
        productName: globalProducts.name,
        productCode: globalProducts.productCode,
        productImageUrl: globalProducts.imageUrl,
        basePrice: globalProducts.basePrice,
        unit: globalProducts.unit,
        branchName: branches.name,
        customName: organizationInventory.customName,
        customPrice: organizationInventory.customPrice,
      })
      .from(branchInventory)
      .leftJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
      .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
      .leftJoin(branches, eq(branchInventory.branchId, branches.id))
      .where(
        productId
          ? and(
              ...conditions,
              eq(organizationInventory.globalProductId, parseInt(productId))
            )
          : and(...conditions)
      )
      .orderBy(desc(branchInventory.assignedAt))
      .limit(limit)
      .offset(offset),

      db.select({ count: sql<number>`count(*)` })
        .from(branchInventory)
        .leftJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
        .where(
          productId
            ? and(
                ...conditions,
                eq(organizationInventory.globalProductId, parseInt(productId))
              )
            : and(...conditions)
        ),
    ])

    const total = totalResult[0].count

    return NextResponse.json({ items, total, page, limit })
  } catch (error) {
    console.error("Error fetching branch assignments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// POST /api/v1/head-office/branch-assignments - Assign organization inventory products to branches
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "HEAD_OFFICE" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Head Office or Super Admin access required" }, { status: 403 })
    }

    const organizationId = (session.user as any).organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found in session" }, { status: 400 })
    }

    const body = await req.json()
    const { 
      organizationInventoryIds, 
      branchIds, 
      isVisible = true,
      isActive = true,
      stockQuantity = 0,
      reorderThreshold = 10
    } = body

    if (!organizationInventoryIds || organizationInventoryIds.length === 0) {
      return NextResponse.json({ error: "Organization inventory IDs are required" }, { status: 400 })
    }
    if (!branchIds || branchIds.length === 0) {
      return NextResponse.json({ error: "Branch IDs are required" }, { status: 400 })
    }

    // Verify all organization inventory items belong to this organization
    const orgInventoryItems = await db.select({
      id: organizationInventory.id,
      globalProductId: organizationInventory.globalProductId,
    })
    .from(organizationInventory)
    .where(
      and(
        eq(organizationInventory.organizationId, parseInt(organizationId)),
        inArray(organizationInventory.id, organizationInventoryIds.map(id => parseInt(id))),
        isNull(organizationInventory.deletedAt)
      )
    )

    if (orgInventoryItems.length !== organizationInventoryIds.length) {
      return NextResponse.json({ error: "Some inventory items not found or access denied" }, { status: 400 })
    }

    // Check for existing assignments to avoid duplicates
    const existingAssignments = await db.select({
      organizationInventoryId: branchInventory.organizationInventoryId,
      branchId: branchInventory.branchId,
    })
    .from(branchInventory)
    .where(
      and(
        inArray(branchInventory.organizationInventoryId, organizationInventoryIds.map(id => parseInt(id))),
        inArray(branchInventory.branchId, branchIds.map(id => parseInt(id))),
        isNull(branchInventory.deletedAt)
      )
    )

    // Create a set of existing assignment keys for quick lookup
    const existingKeys = new Set(
      existingAssignments.map(a => `${a.organizationInventoryId}-${a.branchId}`)
    )

    // Create assignments for each inventory item and branch combination
    const assignments = []
    for (const orgInventoryId of organizationInventoryIds) {
      const orgItem = orgInventoryItems.find(item => item.id === parseInt(orgInventoryId))
      if (!orgItem) continue

      for (const branchId of branchIds) {
        const key = `${orgInventoryId}-${branchId}`
        if (!existingKeys.has(key)) {
          assignments.push({
            branchId: parseInt(branchId),
            organizationId: parseInt(organizationId),
            organizationInventoryId: parseInt(orgInventoryId),
            assignedByUserId: (session.user as any).id,
            isVisible,
            isActive,
            stockQuantity,
            reorderThreshold,
          })
        }
      }
    }

    if (assignments.length === 0) {
      return NextResponse.json({ 
        message: "All selected products are already assigned to the selected branches",
        assignments: []
      })
    }

    const newAssignments = await db.insert(branchInventory)
      .values(assignments)
      .returning()

    // Log the assignment creation
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "BranchAssignment",
      entityId: newAssignments.map(a => a.id).join(','),
      metadata: { 
        assignedCount: newAssignments.length,
        organizationId,
        organizationInventoryIds,
        branchIds,
        skippedCount: (organizationInventoryIds.length * branchIds.length) - newAssignments.length
      },
    })

    return NextResponse.json({
      message: `${newAssignments.length} products assigned to branches successfully!`,
      assignments: newAssignments,
      skipped: (organizationInventoryIds.length * branchIds.length) - newAssignments.length
    })
  } catch (error: any) {
    console.error("Error creating branch assignments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// DELETE /api/v1/head-office/branch-assignments - Remove product from branch
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "HEAD_OFFICE" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Head Office or Super Admin access required" }, { status: 403 })
    }

    const organizationId = (session.user as any).organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found in session" }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const branchId = searchParams.get("branchId")
    const productId = searchParams.get("productId")

    const whereConditions = [
      eq(branchInventory.organizationId, parseInt(organizationId)),
      isNull(branchInventory.deletedAt)
    ]
    
    if (id) {
      whereConditions.push(eq(branchInventory.id, parseInt(id)))
    }
    if (branchId) {
      whereConditions.push(eq(branchInventory.branchId, parseInt(branchId)))
    }
    if (productId) {
      // Resolve product filter via organizationInventory.globalProductId
      // We'll apply this in the query where clause with a join
    }

    if (whereConditions.length === 2) {
      return NextResponse.json({ error: "Assignment ID, Branch ID, or Product ID is required" }, { status: 400 })
    }

    // Find assignments to be deleted
    const assignmentsToDelete = await db.select({
      id: branchInventory.id,
      branchId: branchInventory.branchId,
      organizationInventoryId: branchInventory.organizationInventoryId,
    })
    .from(branchInventory)
    .leftJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
      .where(
        productId
          ? and(
              ...whereConditions,
              eq(organizationInventory.globalProductId, parseInt(productId))
            )
          : and(...whereConditions)
      )

    if (!assignmentsToDelete || assignmentsToDelete.length === 0) {
      return NextResponse.json({ error: "No assignments found" }, { status: 404 })
    }

    // Soft delete the assignments
    const now = new Date()
    await db.update(branchInventory)
      .set({ 
        deletedAt: now,
        updatedAt: now
      })
      .where(
        productId
          ? and(
              ...whereConditions,
              inArray(
                branchInventory.id,
                assignmentsToDelete.map(a => a.id)
              )
            )
          : and(...whereConditions)
      )

    // Log the assignment deletion
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "BranchAssignment",
      entityId: id || "bulk",
      metadata: { 
        deletedCount: assignmentsToDelete.length,
        organizationId,
        branchId,
        productId
      },
    })

    return NextResponse.json({
      message: "Branch assignments removed successfully",
      count: assignmentsToDelete.length
    })
  } catch (error: any) {
    console.error("Error deleting branch assignments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// PUT /api/v1/head-office/branch-assignments - Update branch-level settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "HEAD_OFFICE" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Head Office or Super Admin access required" }, { status: 403 })
    }

    const organizationId = (session.user as any).organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found in session" }, { status: 400 })
    }

    const body = await req.json()
    const {
      id,
      isVisible,
      isActive,
      stockQuantity,
      reorderThreshold
    } = body

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })
    }

    const updateData: any = {
      updatedAt: new Date()
    }
    
    if (isVisible !== undefined) updateData.isVisible = isVisible
    if (isActive !== undefined) updateData.isActive = isActive
    if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity
    if (reorderThreshold !== undefined) updateData.reorderThreshold = reorderThreshold

    const [updatedAssignment] = await db.update(branchInventory)
      .set(updateData)
      .where(
        and(
          eq(branchInventory.id, parseInt(id)),
          eq(branchInventory.organizationId, parseInt(organizationId)),
          isNull(branchInventory.deletedAt)
        )
      )
      .returning()

    if (!updatedAssignment) {
      return NextResponse.json({ error: "Assignment not found or access denied" }, { status: 404 })
    }

    // Log the update
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "BranchAssignment",
      entityId: id.toString(),
      metadata: { 
        organizationId,
        updateData,
        level: "head_office"
      },
    })

    return NextResponse.json({
      message: "Branch assignment updated successfully",
      assignment: updatedAssignment
    })
  } catch (error: any) {
    console.error("Error updating branch assignment:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

