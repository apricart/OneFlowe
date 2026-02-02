import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, pool } from "@/lib/db"
import { branchInventory, organizationInventory, branches, globalProducts, auditLogs, groups } from "@/db/schema"
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm"
import { logInventoryAction } from "@/lib/global-logger"

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
    const groupId = searchParams.get("groupId") // New parameter
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

    if (groupId) {
      conditions.push(eq(branches.groupId, parseInt(groupId)))
    }

    console.log('[API] GET branch-assignments params:', { organizationId, branchId, groupId })
    console.log('[API] Conditions count:', conditions.length)
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
        .leftJoin(branches, eq(branchInventory.branchId, branches.id))
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

    const body = await req.json()
    const {
      organizationInventoryIds,
      branchIds: directBranchIds, // Optional: for backward compatibility
      groupId, // New: assign to all branches in a group
      organizationId: bodyOrgId,
      isVisible = true,
      isActive = true,
    } = body

    // Debug logging
    console.log('POST /api/v1/head-office/branch-assignments received:', {
      organizationInventoryIds,
      directBranchIds,
      groupId,
      organizationIdTypes: {
        orgInvIds: organizationInventoryIds?.map((id: any) => typeof id),
        branchIds: directBranchIds?.map((id: any) => typeof id)
      }
    })

    // Get organizationId from session or body (for Super Admin context selector)
    let organizationId = (session.user as any).organizationId
    if (userRole === "SUPER_ADMIN" && bodyOrgId) {
      organizationId = bodyOrgId
    }
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 })
    }

    if (!organizationInventoryIds || organizationInventoryIds.length === 0) {
      return NextResponse.json({ error: "Organization inventory IDs are required" }, { status: 400 })
    }

    // Determine branch IDs: either from groupId (expanded) or direct branchIds
    let branchIds: number[] = []
    let groupName: string | null = null

    if (groupId) {
      // Fetch group and validate it belongs to the organization
      const [group] = await db.select()
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1)

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 400 })
      }

      if (group.organizationId !== parseInt(organizationId)) {
        return NextResponse.json({ error: "Group does not belong to this organization" }, { status: 403 })
      }

      groupName = group.name

      // Fetch all branches in this group
      const groupBranches = await db.select({
        id: branches.id,
      })
        .from(branches)
        .where(
          and(
            eq(branches.organizationId, parseInt(organizationId)),
            eq(branches.groupId, groupId)
          )
        )

      if (groupBranches.length === 0) {
        return NextResponse.json({ error: `No branches found in group "${groupName}"` }, { status: 400 })
      }

      branchIds = groupBranches.map(b => b.id)
      console.log(`Expanded groupId ${groupId} to ${branchIds.length} branches:`, branchIds)
    } else if (directBranchIds && directBranchIds.length > 0) {
      // Use direct branch IDs (backward compatibility)
      branchIds = directBranchIds
    } else {
      return NextResponse.json({ error: "Either groupId or branchIds is required" }, { status: 400 })
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
          inArray(organizationInventory.id, organizationInventoryIds),
          isNull(organizationInventory.deletedAt)
        )
      )

    console.log('Organization inventory validation:', {
      requested: organizationInventoryIds,
      found: orgInventoryItems.map(i => i.id),
      organizationId: parseInt(organizationId)
    })

    if (orgInventoryItems.length !== organizationInventoryIds.length) {
      return NextResponse.json({ error: "Some inventory items not found or access denied" }, { status: 400 })
    }

    // Check for ALL existing assignments (including soft-deleted) to handle unique constraint
    const allExistingAssignments = await db.select({
      id: branchInventory.id,
      organizationInventoryId: branchInventory.organizationInventoryId,
      branchId: branchInventory.branchId,
      deletedAt: branchInventory.deletedAt,
    })
      .from(branchInventory)
      .where(
        and(
          inArray(branchInventory.organizationInventoryId, organizationInventoryIds),
          inArray(branchInventory.branchId, branchIds)
        )
      )

    // Separate active and soft-deleted assignments
    const activeKeys = new Set(
      allExistingAssignments
        .filter(a => a.deletedAt === null)
        .map(a => `${a.organizationInventoryId}-${a.branchId}`)
    )
    const softDeletedAssignments = allExistingAssignments.filter(a => a.deletedAt !== null)

    // Create assignments for each inventory item and branch combination
    const toInsert = []
    const toRestore: number[] = []  // IDs of soft-deleted records to restore

    for (const orgInventoryId of organizationInventoryIds) {
      const orgItem = orgInventoryItems.find(item => item.id === orgInventoryId)
      if (!orgItem) continue

      for (const branchId of branchIds) {
        const key = `${orgInventoryId}-${branchId}`

        // Skip if already active
        if (activeKeys.has(key)) continue

        // Check if soft-deleted record exists - restore it instead of inserting
        const softDeleted = softDeletedAssignments.find(
          a => a.organizationInventoryId === orgInventoryId && a.branchId === branchId
        )

        if (softDeleted) {
          toRestore.push(softDeleted.id)
        } else {
          toInsert.push({
            branchId: Number(branchId),
            organizationId: Number(organizationId),
            organizationInventoryId: Number(orgInventoryId),
            assignedByUserId: (session.user as any).id,
            isVisible: Boolean(isVisible),
            isActive: Boolean(isActive),
          })
        }
      }
    }

    console.log('Operations:', { toInsert: toInsert.length, toRestore: toRestore.length })

    if (toInsert.length === 0 && toRestore.length === 0) {
      return NextResponse.json({
        message: "All selected products are already assigned to the selected branches",
        assignments: []
      })
    }

    const newAssignments = []

    // Restore soft-deleted records
    if (toRestore.length > 0) {
      const restored = await db.update(branchInventory)
        .set({
          deletedAt: null,
          isActive: isActive,
          isVisible: isVisible,
          assignedByUserId: (session.user as any).id,
          updatedAt: new Date(),
        })
        .where(inArray(branchInventory.id, toRestore))
        .returning()

      newAssignments.push(...restored)
      console.log('Restored assignments:', restored.length)
    }

    // Insert new records
    if (toInsert.length > 0) {
      for (const assignment of toInsert) {
        try {
          const [result] = await db.insert(branchInventory)
            .values(assignment)
            .returning()
          newAssignments.push(result)
        } catch (insertError: any) {
          console.error("Insert failed:", assignment, insertError.message)
          return NextResponse.json({
            error: insertError.message,
            code: insertError.code,
            detail: insertError.detail
          }, { status: 500 })
        }
      }
      console.log('Inserted assignments:', toInsert.length)
    }

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
        groupId: groupId || null,
        groupName: groupName || null,
        skippedCount: (organizationInventoryIds.length * branchIds.length) - newAssignments.length
      },
    })

    // Log to inventory audit file
    logInventoryAction(
      'ASSIGN',
      'BRANCH_ASSIGNMENT',
      {
        id: (session.user as any).id,
        email: (session.user as any).email,
        role: (session.user as any).role
      },
      {
        organizationId: parseInt(organizationId),
        productIds: organizationInventoryIds,
        assignmentIds: newAssignments.map(a => a.id),
        count: newAssignments.length,
        metadata: {
          branchIds: branchIds,
          groupId: groupId || null,
          groupName: groupName || null,
          skipped: (organizationInventoryIds.length * branchIds.length) - newAssignments.length
        }
      }
    )

    return NextResponse.json({
      message: groupName
        ? `${newAssignments.length} products assigned to group "${groupName}" (${branchIds.length} branches) successfully!`
        : `${newAssignments.length} products assigned to branches successfully!`,
      assignments: newAssignments,
      skipped: (organizationInventoryIds.length * branchIds.length) - newAssignments.length,
      groupName: groupName,
      branchCount: branchIds.length
    })
  } catch (error: any) {
    console.error("Error creating branch assignments:")
    console.error("Error message:", error.message)
    console.error("Error code:", error.code)
    console.error("Error detail:", error.detail)
    console.error("Error constraint:", error.constraint)
    console.error("Error stack:", error.stack)

    // Check for duplicate key constraint
    if (error.message?.includes('duplicate key') || error.code === '23505') {
      return NextResponse.json({
        error: "Some products are already assigned to these branches",
        details: error.detail || error.message
      }, { status: 400 })
    }

    // Check for foreign key constraint violation
    if (error.code === '23503') {
      return NextResponse.json({
        error: "Invalid reference: One or more IDs do not exist in the database",
        details: error.detail || "Check that organization inventory items, branches, and user exist",
        constraint: error.constraint
      }, { status: 400 })
    }

    // Return detailed error for debugging
    return NextResponse.json({
      error: error.message || "Internal Server Error",
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint
    }, { status: 500 })
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

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const branchId = searchParams.get("branchId")
    const productId = searchParams.get("productId")
    const queryOrgId = searchParams.get("organizationId")

    // Get organization ID - from session for HEAD_OFFICE, from query param for SUPER_ADMIN
    let organizationId = (session.user as any).organizationId

    // SUPER_ADMIN can pass organizationId via query param, or we'll get it from the assignment
    if (userRole === "SUPER_ADMIN" && !organizationId) {
      organizationId = queryOrgId
    }

    // If deleting by specific ID, we can look up the organization from the assignment
    if (id && !organizationId) {
      const [assignment] = await db.select({ organizationId: branchInventory.organizationId })
        .from(branchInventory)
        .where(eq(branchInventory.id, parseInt(id)))
        .limit(1)
      if (assignment) {
        organizationId = String(assignment.organizationId)
      }
    }

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 })
    }

    // Parse organizationId to number for use in queries and logging
    const orgIdNum = parseInt(String(organizationId))

    const whereConditions = [
      eq(branchInventory.organizationId, orgIdNum),
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
    try {
      await db.insert(auditLogs).values({
        userId: (session.user as any).id,
        organizationId: orgIdNum,
        action: "DELETE",
        entity: "BranchAssignment",
        entityId: id || "bulk",
        metadata: {
          deletedCount: assignmentsToDelete.length,
          branchId,
          productId
        },
      })
    } catch (auditError) {
      console.error("Failed to insert audit log:", auditError)
    }

    // Log to inventory audit file
    try {
      logInventoryAction(
        'REMOVE',
        'BRANCH_ASSIGNMENT',
        {
          id: (session.user as any).id,
          email: (session.user as any).email || 'unknown',
          role: (session.user as any).role || userRole
        },
        {
          organizationId: orgIdNum,
          branchId: branchId ? parseInt(branchId) : undefined,
          assignmentIds: assignmentsToDelete.map(a => a.id),
          count: assignmentsToDelete.length,
          metadata: { productId }
        }
      )
    } catch (logError) {
      console.error("Failed to log inventory action:", logError)
    }

    return NextResponse.json({
      message: "Branch assignments removed successfully",
      count: assignmentsToDelete.length
    })
  } catch (error: any) {
    console.error("Error deleting branch assignments:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
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

