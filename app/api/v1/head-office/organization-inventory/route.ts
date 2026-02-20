import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { organizationInventory, globalProducts, categories, auditLogs } from "@/db/schema"
import { eq, and, like, or, desc, sql, isNull, SQL, ne } from "drizzle-orm"
import { cascadeOrgStatusChange } from "@/lib/inventory-cascade"

// GET /api/v1/head-office/organization-inventory - List products in organization inventory
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

    // Get organization ID from session context (should be set by middleware)
    // For Super Admin, get from query params if available
    let organizationId = (session.user as any).organizationId
    if (userRole === "SUPER_ADMIN") {
      const { searchParams } = new URL(req.url)
      const orgIdParam = searchParams.get("organizationId")
      if (orgIdParam) {
        organizationId = parseInt(orgIdParam)
      }
    }
    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found in session" }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const status = searchParams.get("status") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions: (SQL | undefined)[] = [
      eq(organizationInventory.organizationId, parseInt(organizationId)),
      isNull(organizationInventory.deletedAt),
      eq(globalProducts.status, "active"),
      eq(organizationInventory.isActive, true)
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
    if (category) {
      conditions.push(eq(globalProducts.categoryId, parseInt(category)))
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
        updatedAt: organizationInventory.updatedAt,
        // Global product details
        productName: globalProducts.name,
        productCode: globalProducts.productCode,
        productImageUrl: globalProducts.imageUrl,
        basePrice: globalProducts.basePrice,
        unit: globalProducts.unit,
        status: globalProducts.status,
        categoryName: categories.name,
        discountType: globalProducts.discountType,
        discountValue: globalProducts.discountValue,
        discountStartAt: globalProducts.discountStartAt,
        discountEndAt: globalProducts.discountEndAt,
        discountActive: globalProducts.discountActive,
      })
        .from(organizationInventory)
        .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
        .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
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

    // For non-Super Admin users, remove basePrice from response (it's internal)
    // UPDATE: We now expose basePrice as the default cost if no customPrice is set
    const sanitizedItems = items

    return NextResponse.json({ items: sanitizedItems, total, page, limit })
  } catch (error) {
    console.error("Error fetching organization inventory:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// PUT /api/v1/head-office/organization-inventory - Update organization-level overrides
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

    // Get organization ID from session context (should be set by middleware)
    // For Super Admin, get from request body if available
    let organizationId = (session.user as any).organizationId
    if (body.organizationId) {
      organizationId = parseInt(body.organizationId)
    }
    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found in session" }, { status: 400 })
    }
    const {
      id,
      isActive,
      customName,
      customPrice,
      customDescription,
      customImageUrl
    } = body

    if (!id) {
      return NextResponse.json({ error: "Inventory ID is required" }, { status: 400 })
    }

    // Check if inventory item exists and get current status
    const [existingItem] = await db.select({
      id: organizationInventory.id,
      isActive: organizationInventory.isActive,
    })
      .from(organizationInventory)
      .where(
        and(
          eq(organizationInventory.id, parseInt(id)),
          eq(organizationInventory.organizationId, parseInt(organizationId)),
          isNull(organizationInventory.deletedAt)
        )
      )
      .limit(1)

    if (!existingItem) {
      return NextResponse.json({ error: "Inventory item not found or access denied" }, { status: 404 })
    }

    const updateData: any = {
      updatedAt: new Date()
    }

    if (isActive !== undefined) updateData.isActive = isActive
    if (customName !== undefined) updateData.customName = customName || null
    if (customPrice !== undefined) updateData.customPrice = customPrice ? Math.round(parseFloat(customPrice) * 100) : null
    if (customDescription !== undefined) updateData.customDescription = customDescription || null
    if (customImageUrl !== undefined) updateData.customImageUrl = customImageUrl || null

    const [updatedInventory] = await db.update(organizationInventory)
      .set(updateData)
      .where(
        and(
          eq(organizationInventory.id, parseInt(id)),
          eq(organizationInventory.organizationId, parseInt(organizationId))
        )
      )
      .returning()

    // If isActive status changed, cascade to branches
    if (isActive !== undefined && isActive !== existingItem.isActive) {
      const cascadeResult = await cascadeOrgStatusChange(
        parseInt(id),
        isActive,
        (session.user as any).id,
        "HEAD_OFFICE"
      )

      // Log the cascade update
      await db.insert(auditLogs).values({
        userId: (session.user as any).id,
        action: "CASCADE_UPDATE",
        entity: "OrganizationInventory",
        entityId: id.toString(),
        metadata: {
          organizationInventoryId: parseInt(id),
          isActive,
          branchUpdates: cascadeResult.updatedCount,
          affectedBranches: cascadeResult.affectedBranches,
          performedByRole: "HEAD_OFFICE"
        },
      })
    }

    // Log the update
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "OrganizationInventory",
      entityId: id.toString(),
      metadata: {
        organizationId,
        updateData,
        level: "head_office"
      },
    })

    return NextResponse.json({
      message: "Inventory updated successfully",
      inventory: updatedInventory
    })
  } catch (error: any) {
    console.error("Error updating organization inventory:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

