import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { branchInventory, globalProducts, organizationInventory, categories, auditLogs } from "@/db/schema"
import { eq, and, like, or, desc, sql, isNull } from "drizzle-orm"
import { getEffectiveProductData } from "@/lib/inventory-cascade"

// GET /api/v1/branch/inventory - List products in branch inventory
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    let organizationId = (session.user as any).organizationId
    let branchId = (session.user as any).branchId
    
    const { searchParams } = new URL(req.url)
    
    // Allow BRANCH_ADMIN to access their own inventory
    // Allow HEAD_OFFICE and SUPER_ADMIN to access if they provide branchId param
    if (userRole === "BRANCH_ADMIN") {
      // BRANCH_ADMIN uses their own branch
      if (!organizationId || !branchId) {
        return NextResponse.json({ error: "Organization or branch not found in session" }, { status: 400 })
      }
    } else if (userRole === "HEAD_OFFICE" || userRole === "SUPER_ADMIN") {
      // Admin users need to specify branchId in query params
      const branchIdParam = searchParams.get("branchId")
      const orgIdParam = searchParams.get("organizationId")
      
      if (!branchIdParam) {
        return NextResponse.json({ error: "branchId parameter required for admin users" }, { status: 400 })
      }
      
      branchId = parseInt(branchIdParam)
      if (!Number.isFinite(branchId)) {
        return NextResponse.json({ error: "Invalid branch ID" }, { status: 400 })
      }

      // Use organizationId from query param if provided (from context selector), otherwise use session
      if (orgIdParam) {
        organizationId = parseInt(orgIdParam)
        if (!Number.isFinite(organizationId)) {
          return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
        }
      } else if (!organizationId) {
        return NextResponse.json({ error: "Organization context not found" }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Forbidden - Access denied" }, { status: 403 })
    }

    const search = searchParams.get("search") || ""
    const visibility = searchParams.get("visibility") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions = [
      eq(branchInventory.organizationId, parseInt(organizationId)),
      eq(branchInventory.branchId, branchId),
      isNull(branchInventory.deletedAt),
      isNull(organizationInventory.deletedAt)
    ]
    
    if (search) {
      conditions.push(
        or(
          like(globalProducts.name, `%${search}%`),
          like(globalProducts.productCode, `%${search}%`),
          like(organizationInventory.customName, `%${search}%`)
        )
      )
    }
    if (visibility) {
      if (visibility === "visible") {
        conditions.push(eq(branchInventory.isVisible, true))
      } else if (visibility === "hidden") {
        conditions.push(eq(branchInventory.isVisible, false))
      }
    }

    const whereClause = and(...conditions)

    const [items, totalResult] = await Promise.all([
      db.select({
        id: branchInventory.id,
        branchId: branchInventory.branchId,
        organizationId: branchInventory.organizationId,
        organizationInventoryId: branchInventory.organizationInventoryId,
        isVisible: branchInventory.isVisible,
        isActive: branchInventory.isActive,
        stockQuantity: branchInventory.stockQuantity,
        reorderThreshold: branchInventory.reorderThreshold,
        assignedAt: branchInventory.assignedAt,
        updatedAt: branchInventory.updatedAt,
        // Global product details
        productName: globalProducts.name,
        productCode: globalProducts.productCode,
        productImageUrl: globalProducts.imageUrl,
        basePrice: globalProducts.basePrice,
        unit: globalProducts.unit,
        status: globalProducts.status,
        categoryName: categories.name,
        // Organization overrides
        customName: organizationInventory.customName,
        customPrice: organizationInventory.customPrice,
        customDescription: organizationInventory.customDescription,
        customImageUrl: organizationInventory.customImageUrl,
      })
      .from(branchInventory)
      .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
      .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
      .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(branchInventory.assignedAt))
      .limit(limit)
      .offset(offset),

      db.select({ count: sql<number>`count(*)` })
        .from(branchInventory)
        .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
        .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
        .where(whereClause),
    ])

    const total = totalResult[0].count

    return NextResponse.json({ items, total, page, limit })
  } catch (error) {
    console.error("Error fetching branch inventory:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// PUT /api/v1/branch/inventory - Toggle visibility and update stock levels
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "BRANCH_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Branch Admin access required" }, { status: 403 })
    }

    const organizationId = (session.user as any).organizationId
    const branchId = (session.user as any).branchId
    
    if (!organizationId || !branchId) {
      return NextResponse.json({ error: "Organization or branch not found in session" }, { status: 400 })
    }

    const body = await req.json()
    const {
      id,
      isVisible,
      stockQuantity,
      reorderThreshold
    } = body

    if (!id) {
      return NextResponse.json({ error: "Inventory ID is required" }, { status: 400 })
    }

    // Validate that only allowed fields are being updated
    const allowedFields = ['isVisible', 'stockQuantity', 'reorderThreshold']
    const providedFields = Object.keys(body).filter(key => key !== 'id')
    const invalidFields = providedFields.filter(field => !allowedFields.includes(field))
    
    if (invalidFields.length > 0) {
      return NextResponse.json({ 
        error: `Branch admin can only update: ${allowedFields.join(', ')}. Invalid fields: ${invalidFields.join(', ')}` 
      }, { status: 400 })
    }

    const updateData: any = {
      updatedAt: new Date()
    }
    
    if (isVisible !== undefined) updateData.isVisible = isVisible
    if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity
    if (reorderThreshold !== undefined) updateData.reorderThreshold = reorderThreshold

    const [updatedInventory] = await db.update(branchInventory)
      .set(updateData)
      .where(
        and(
          eq(branchInventory.id, parseInt(id)),
          eq(branchInventory.organizationId, parseInt(organizationId)),
          eq(branchInventory.branchId, parseInt(branchId)),
          isNull(branchInventory.deletedAt)
        )
      )
      .returning()

    if (!updatedInventory) {
      return NextResponse.json({ error: "Inventory item not found or access denied" }, { status: 404 })
    }

    // Log the update
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "BranchInventory",
      entityId: id.toString(),
      metadata: { 
        organizationId,
        branchId,
        updateData,
        level: "branch_admin"
      },
    })

    return NextResponse.json({
      message: "Inventory updated successfully",
      inventory: updatedInventory
    })
  } catch (error: any) {
    console.error("Error updating branch inventory:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

