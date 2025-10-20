import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { globalProducts, categories, organizationInventory, organizations, auditLogs } from "@/db/schema"
import { eq, and, like, or, desc, sql, inArray, isNull } from "drizzle-orm"
import { cascadeGlobalProductDeletion, cascadeGlobalProductStatusChange } from "@/lib/inventory-cascade"

// GET /api/v1/admin/global-inventory - List all global products with assignment stats
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
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const status = searchParams.get("status") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions = []
    if (search) {
      conditions.push(
        or(
          like(globalProducts.name, `%${search}%`),
          like(globalProducts.productCode, `%${search}%`),
          like(globalProducts.description, `%${search}%`)
        )
      )
    }
    if (category) {
      conditions.push(eq(globalProducts.categoryId, parseInt(category)))
    }
    if (status && status !== "all") {
      conditions.push(eq(globalProducts.status, status))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Fetch products with pagination and category information
    const [items, totalResult] = await Promise.all([
      db.select({
        id: globalProducts.id,
        productCode: globalProducts.productCode,
        name: globalProducts.name,
        description: globalProducts.description,
        categoryId: globalProducts.categoryId,
        imageUrl: globalProducts.imageUrl,
        basePrice: globalProducts.basePrice,
        unit: globalProducts.unit,
        status: globalProducts.status,
        metadata: globalProducts.metadata,
        createdAt: globalProducts.createdAt,
        updatedAt: globalProducts.updatedAt,
        categoryName: categories.name,
      })
      .from(globalProducts)
      .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(globalProducts.createdAt))
      .limit(limit)
      .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(globalProducts).where(whereClause)
    ])

    const total = totalResult[0]?.count || 0

    // Get assignment counts for each product
    const productIds = items.map(item => item.id)
    const assignmentCounts = productIds.length > 0 ? await db.select({
      globalProductId: organizationInventory.globalProductId,
      assignedOrganizations: sql<number>`count(distinct ${organizationInventory.organizationId})`,
    })
    .from(organizationInventory)
    .where(
      and(
        inArray(organizationInventory.globalProductId, productIds),
        eq(organizationInventory.isActive, true)
      )
    )
    .groupBy(organizationInventory.globalProductId) : []

    // Create a map for quick lookup
    const assignmentMap = new Map()
    assignmentCounts.forEach(assignment => {
      assignmentMap.set(assignment.globalProductId, {
        assignedOrganizations: assignment.assignedOrganizations,
      })
    })

    // Add assignment counts to items
    const itemsWithAssignments = items.map(item => ({
      ...item,
      assignedOrganizations: assignmentMap.get(item.id)?.assignedOrganizations || 0,
    }))

    return NextResponse.json({
      items: itemsWithAssignments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error("Error fetching global products:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/v1/admin/global-inventory - Create new global product
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
    const {
      productCode,
      name,
      description,
      categoryId,
      imageUrl,
      basePrice,
      unit,
      status = "active",
      metadata = {}
    } = body

    if (!productCode || !name || !basePrice) {
      return NextResponse.json({ error: "Product code, name, and base price are required" }, { status: 400 })
    }

    // Check if product code already exists
    const existingProduct = await db.select()
      .from(globalProducts)
      .where(eq(globalProducts.productCode, productCode))
      .limit(1)

    if (existingProduct.length > 0) {
      return NextResponse.json({ error: "Product code already exists" }, { status: 400 })
    }

    const [newProduct] = await db.insert(globalProducts)
      .values({
        productCode,
        name,
        description: description || null,
        categoryId: categoryId ? parseInt(categoryId) : null,
        imageUrl: imageUrl || null,
        basePrice: Math.round(parseFloat(basePrice) * 100), // Convert to cents
        unit: unit || "unit",
        status,
        metadata,
      })
      .returning()

    // Log the creation
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "GlobalProduct",
      entityId: newProduct.id.toString(),
      metadata: { productCode, name, basePrice },
    })

    return NextResponse.json({
      message: "Product created successfully",
      product: newProduct
    })
  } catch (error: any) {
    console.error("Error creating product:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/v1/admin/global-inventory - Update global product
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
      productCode,
      name,
      description,
      categoryId,
      imageUrl,
      basePrice,
      unit,
      status,
      metadata
    } = body

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    // Check if product exists and get current status
    const [existingProduct] = await db.select({
      id: globalProducts.id,
      status: globalProducts.status,
    })
    .from(globalProducts)
    .where(eq(globalProducts.id, parseInt(id)))
    .limit(1)

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const updateData: any = {}
    if (productCode !== undefined) updateData.productCode = productCode
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (categoryId !== undefined) updateData.categoryId = categoryId ? parseInt(categoryId) : null
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (basePrice !== undefined) updateData.basePrice = Math.round(parseFloat(basePrice) * 100)
    if (unit !== undefined) updateData.unit = unit
    if (status !== undefined) updateData.status = status
    if (metadata !== undefined) updateData.metadata = metadata
    updateData.updatedAt = new Date()

    const [updatedProduct] = await db.update(globalProducts)
      .set(updateData)
      .where(eq(globalProducts.id, parseInt(id)))
      .returning()

    // If status changed to inactive/discontinued, cascade to organization and branch inventory
    if (status !== undefined && status !== existingProduct.status) {
      const cascadeResult = await cascadeGlobalProductStatusChange(
        parseInt(id),
        status,
        (session.user as any).id,
        "SUPER_ADMIN"
      )

      // Log the cascade update
      await db.insert(auditLogs).values({
        userId: (session.user as any).id,
        action: "CASCADE_UPDATE",
        entity: "GlobalProduct",
        entityId: id.toString(),
        metadata: {
          globalProductId: parseInt(id),
          status,
          orgUpdates: cascadeResult.updatedOrgCount,
          branchUpdates: cascadeResult.updatedBranchCount,
          affectedOrgs: cascadeResult.affectedOrgs,
          affectedBranches: cascadeResult.affectedBranches,
          performedByRole: "SUPER_ADMIN"
        },
      })
    }

    // Log the update
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "UPDATE",
      entity: "GlobalProduct",
      entityId: id.toString(),
      metadata: updateData,
    })

    return NextResponse.json({
      message: "Product updated successfully",
      product: updatedProduct
    })
  } catch (error: any) {
    console.error("Error updating product:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/v1/admin/global-inventory - Delete global product
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

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    // Check if product exists
    const [existingProduct] = await db.select({
      id: globalProducts.id,
      productCode: globalProducts.productCode,
      name: globalProducts.name,
    })
    .from(globalProducts)
    .where(eq(globalProducts.id, parseInt(id)))
    .limit(1)

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Cascade deletion to organization and branch inventory
    const cascadeResult = await cascadeGlobalProductDeletion(
      parseInt(id),
      (session.user as any).id,
      "SUPER_ADMIN"
    )

    // Soft delete the global product
    await db.update(globalProducts)
      .set({ 
        status: "discontinued",
        updatedAt: new Date()
      })
      .where(eq(globalProducts.id, parseInt(id)))

    return NextResponse.json({
      message: "Product deleted successfully",
      product: existingProduct,
      cascadeResult: {
        deletedOrgCount: cascadeResult.deletedOrgCount,
        deletedBranchCount: cascadeResult.deletedBranchCount,
        affectedOrgs: cascadeResult.affectedOrgs,
        affectedBranches: cascadeResult.affectedBranches
      }
    })
  } catch (error: any) {
    console.error("Error deleting product:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

