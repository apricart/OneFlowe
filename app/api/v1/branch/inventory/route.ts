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
    // Allow EMPLOYEE to access their assigned branch inventory
    // Allow HEAD_OFFICE and SUPER_ADMIN to access if they provide branchId param
    if (userRole === "BRANCH_ADMIN" || userRole === "EMPLOYEE") {
      // BRANCH_ADMIN and EMPLOYEE use their own branch
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

    const orgIdNum = typeof organizationId === "string" ? parseInt(organizationId) : organizationId

    // Build conditions based on organization-level inventory, with optional branch overrides
    const conditions = [
      eq(organizationInventory.organizationId, orgIdNum),
      isNull(organizationInventory.deletedAt),
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
        // Visible when explicitly marked visible OR no branch override exists
        conditions.push(
          or(
            eq(branchInventory.isVisible, true),
            isNull(branchInventory.id)
          )
        )
      } else if (visibility === "hidden") {
        // Hidden only when branch override says so
        conditions.push(eq(branchInventory.isVisible, false))
      }
    }

    const whereClause = and(...conditions)

    const [items, totalResult] = await Promise.all([
      db.select({
        // Use organization-level ID as stable fallback when branch row doesn't exist
        id: sql<number>`COALESCE(${branchInventory.id}, ${organizationInventory.id})`,
        branchId: branchInventory.branchId,
        organizationId: organizationInventory.organizationId,
        organizationInventoryId: organizationInventory.id,
        isVisible: sql<boolean>`COALESCE(${branchInventory.isVisible}, true)`,
        isActive: sql<boolean>`COALESCE(${branchInventory.isActive}, true)`,
        // Stock comes from global products (single source of truth)
        stockQuantity: globalProducts.stockQuantity,
        // Reorder threshold no longer used – always 0 for compatibility
        reorderThreshold: sql<number>`0`,
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
      .from(organizationInventory)
      .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
      .leftJoin(
        branchInventory,
        and(
          eq(branchInventory.organizationInventoryId, organizationInventory.id),
          eq(branchInventory.branchId, branchId),
          isNull(branchInventory.deletedAt),
        )
      )
      .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(organizationInventory.id))
      .limit(limit)
      .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(organizationInventory)
        .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
        .leftJoin(
          branchInventory,
          and(
            eq(branchInventory.organizationInventoryId, organizationInventory.id),
            eq(branchInventory.branchId, branchId),
            isNull(branchInventory.deletedAt),
          )
        )
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
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const organizationIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")

    if (!organizationIdParam || !branchIdParam) {
      return NextResponse.json({ error: "organizationId and branchId query params are required" }, { status: 400 })
    }

    const organizationId = parseInt(organizationIdParam)
    const branchId = parseInt(branchIdParam)

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

