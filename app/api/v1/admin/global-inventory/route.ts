import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { globalProducts, categories, organizationInventory, organizations, auditLogs } from "@/db/schema"
import { eq, and, like, or, desc, sql, inArray, isNull, ne } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { cascadeGlobalProductDeletion, cascadeGlobalProductStatusChange, cascadeGlobalProductFieldUpdate } from "@/lib/inventory-cascade"
import { escapeLikePattern } from "@/lib/utils"

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
    const id = searchParams.get("id")

    // If an ID is provided, return a single product record
    if (id) {
      const productId = parseInt(id)
      if (Number.isNaN(productId)) {
        return NextResponse.json({ error: "Invalid product ID" }, { status: 400 })
      }

      const [item] = await db
        .select({
          id: globalProducts.id,
          productCode: globalProducts.productCode,
          name: globalProducts.name,
          description: globalProducts.description,
          categoryId: globalProducts.categoryId,
          imageUrl: globalProducts.imageUrl,
          basePrice: globalProducts.basePrice,
          unit: globalProducts.unit,
          status: globalProducts.status,
          stockQuantity: globalProducts.stockQuantity,
          metadata: globalProducts.metadata,
          discountType: globalProducts.discountType,
          discountValue: globalProducts.discountValue,
          discountStartAt: globalProducts.discountStartAt,
          discountEndAt: globalProducts.discountEndAt,
          discountActive: globalProducts.discountActive,
          createdAt: globalProducts.createdAt,
          updatedAt: globalProducts.updatedAt,
          categoryName: categories.name,
        })
        .from(globalProducts)
        .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
        .where(eq(globalProducts.id, productId))
        .limit(1)

      if (!item) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }

      // Compute assignment count for this single product
      const [assignment] = await db
        .select({
          globalProductId: organizationInventory.globalProductId,
          assignedOrganizations: sql<number>`count(distinct ${organizationInventory.organizationId})`,
        })
        .from(organizationInventory)
        .where(
          and(
            eq(organizationInventory.globalProductId, productId),
            eq(organizationInventory.isActive, true)
          )
        )
        .groupBy(organizationInventory.globalProductId)

      const itemWithAssignments = {
        ...item,
        assignedOrganizations: assignment?.assignedOrganizations || 0,
      }

      return NextResponse.json({ item: itemWithAssignments })
    }

    // Otherwise, return paginated list
    const searchRaw = searchParams.get("search") || ""
    const search = searchRaw ? escapeLikePattern(searchRaw) : "" // Sanitize LIKE patterns
    const category = searchParams.get("category") || ""
    const status = searchParams.get("status") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions = [
      isNull(globalProducts.deletedAt)
    ]
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
      const catId = parseInt(category)
      // Check if this is a parent category or a subcategory
      const [catInfo] = await db.select({
        id: categories.id,
        parentId: categories.parentId
      }).from(categories).where(eq(categories.id, catId)).limit(1)

      if (catInfo) {
        if (catInfo.parentId === null) {
          // It's a parent category - find all subcategories
          const subCats = await db.select({ id: categories.id })
            .from(categories)
            .where(eq(categories.parentId, catId))

          const subCatIds = subCats.map(sc => sc.id)
          if (subCatIds.length > 0) {
            conditions.push(inArray(globalProducts.categoryId, subCatIds))
          } else {
            // No subcategories, match nothing if it's a parent with no children
            conditions.push(eq(globalProducts.categoryId, -1))
          }
        } else {
          // It's a subcategory - match directly
          conditions.push(eq(globalProducts.categoryId, catId))
        }
      }
    }

    const subCategory = searchParams.get("subCategory")
    if (subCategory) {
      conditions.push(eq(globalProducts.categoryId, parseInt(subCategory)))
    }

    if (status && status !== "all") {
      conditions.push(eq(globalProducts.status, status))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const subCategories = alias(categories, "subCategories")
    const parentCategories = alias(categories, "parentCategories")

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
        stockQuantity: globalProducts.stockQuantity,
        metadata: globalProducts.metadata,
        discountType: globalProducts.discountType,
        discountValue: globalProducts.discountValue,
        discountStartAt: globalProducts.discountStartAt,
        discountEndAt: globalProducts.discountEndAt,
        discountActive: globalProducts.discountActive,
        createdAt: globalProducts.createdAt,
        updatedAt: globalProducts.updatedAt,
        categoryName: subCategories.name,
        parentCategoryName: parentCategories.name,
      })
        .from(globalProducts)
        .leftJoin(subCategories, eq(globalProducts.categoryId, subCategories.id))
        .leftJoin(parentCategories, eq(subCategories.parentId, parentCategories.id))
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
      stockQuantity = 0,
      metadata = {},
      discountType,
      discountValue, // for percent provide number in basis points (e.g., 1000 = 10%) or cents for flat
      discountStartAt,
      discountEndAt,
      discountActive,
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
        stockQuantity: stockQuantity !== undefined ? Math.max(0, parseInt(String(stockQuantity)) || 0) : 0,
        metadata,
        discountType: discountType || null,
        discountValue: discountValue !== undefined && discountValue !== null ? parseInt(discountValue) : null,
        discountStartAt: discountStartAt ? new Date(discountStartAt) : null,
        discountEndAt: discountEndAt ? new Date(discountEndAt) : null,
        discountActive: !!discountActive,
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
      stockQuantity,
      metadata,
      discountType,
      discountValue,
      discountStartAt,
      discountEndAt,
      discountActive,
    } = body

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    const productId = parseInt(id)

    // Check if product code already exists for another product
    if (productCode) {
      const [existingProductWithCode] = await db.select()
        .from(globalProducts)
        .where(
          and(
            eq(globalProducts.productCode, productCode.toString().trim()),
            ne(globalProducts.id, productId)
          )
        )
        .limit(1)

      if (existingProductWithCode) {
        return NextResponse.json({ error: "Product code already exists" }, { status: 400 })
      }
    }

    // Check if product exists and get current status
    const [existingProduct] = await db.select({
      id: globalProducts.id,
      status: globalProducts.status,
      name: globalProducts.name,
      description: globalProducts.description,
      imageUrl: globalProducts.imageUrl,
      basePrice: globalProducts.basePrice,
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
    if (stockQuantity !== undefined) updateData.stockQuantity = Math.max(0, parseInt(String(stockQuantity)) || 0)
    if (metadata !== undefined) updateData.metadata = metadata
    if (discountType !== undefined) updateData.discountType = discountType || null
    if (discountValue !== undefined) updateData.discountValue = discountValue !== null ? parseInt(discountValue) : null
    if (discountStartAt !== undefined) updateData.discountStartAt = discountStartAt ? new Date(discountStartAt) : null
    if (discountEndAt !== undefined) updateData.discountEndAt = discountEndAt ? new Date(discountEndAt) : null
    if (discountActive !== undefined) updateData.discountActive = !!discountActive
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

    // Identify semantic field changes to clear overrides
    const fieldChanges: Array<{ field: 'name' | 'description' | 'imageUrl' | 'basePrice'; oldValue: any; newValue: any }> = []

    if (name !== undefined && name !== existingProduct.name) {
      fieldChanges.push({ field: 'name', oldValue: existingProduct.name, newValue: name })
    }
    if (description !== undefined && description !== existingProduct.description) {
      fieldChanges.push({ field: 'description', oldValue: existingProduct.description, newValue: description })
    }
    if (imageUrl !== undefined && imageUrl !== existingProduct.imageUrl) {
      fieldChanges.push({ field: 'imageUrl', oldValue: existingProduct.imageUrl, newValue: imageUrl })
    }
    if (basePrice !== undefined) {
      const newPriceCents = Math.round(parseFloat(basePrice) * 100)
      if (newPriceCents !== existingProduct.basePrice) {
        fieldChanges.push({ field: 'basePrice', oldValue: existingProduct.basePrice, newValue: newPriceCents })
      }
    }

    if (fieldChanges.length > 0) {
      const cascadeResult = await cascadeGlobalProductFieldUpdate(
        parseInt(id),
        fieldChanges,
        (session.user as any).id
      )

      if (cascadeResult.updatedCount > 0) {
        console.log(`[Cascade] Cleared ${cascadeResult.updatedCount} overrides for global product ${id}`)
      }
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

    // Handle unique constraint violation (Postgres code 23505)
    // Handle unique constraint violation (Postgres code 23505)
    // Drizzle/pg may wrap the error in a cause property, so we check both
    const errorCode = error.code || (error.cause && error.cause.code)
    const errorMessage = error.message || (error.cause && error.cause.message) || ""

    if (
      errorCode === '23505' ||
      (errorMessage.includes('unique constraint') && errorMessage.includes('product_code'))
    ) {
      return NextResponse.json({ error: "Product code already exists" }, { status: 400 })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/v1/admin/global-inventory - Delete global product (Soft Delete)
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
    const mode = searchParams.get("mode") || "discontinue" // Default to discontinue for backward compatibility

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    const productId = parseInt(id)

    // Check if product exists
    const [existingProduct] = await db.select({
      id: globalProducts.id,
      productCode: globalProducts.productCode,
      name: globalProducts.name,
      status: globalProducts.status,
    })
      .from(globalProducts)
      .where(and(eq(globalProducts.id, productId), isNull(globalProducts.deletedAt)))
      .limit(1)

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    if (mode === "delete") {
      // Soft delete by marking deletedAt
      await db.update(globalProducts)
        .set({
          status: "discontinued",
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(globalProducts.id, productId))
    } else {
      // Just discontinue
      await db.update(globalProducts)
        .set({
          status: "discontinued",
          updatedAt: new Date()
        })
        .where(eq(globalProducts.id, productId))
    }

    // Cascade status change to organization and branch inventory
    const cascadeResult = await cascadeGlobalProductStatusChange(
      productId,
      "discontinued",
      (session.user as any).id,
      "SUPER_ADMIN"
    )

    // Log the action
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: mode === "delete" ? "DELETE" : "UPDATE",
      entity: "GlobalProduct",
      entityId: id.toString(),
      metadata: {
        productCode: existingProduct.productCode,
        productName: existingProduct.name,
        mode,
        type: mode === "delete" ? "soft_delete" : "status_change",
        cascadeResult: {
          updatedOrgCount: cascadeResult.updatedOrgCount,
          updatedBranchCount: cascadeResult.updatedBranchCount,
          affectedOrgs: cascadeResult.affectedOrgs,
          affectedBranches: cascadeResult.affectedBranches
        }
      },
    })

    return NextResponse.json({
      message: "Product deleted successfully",
      product: existingProduct,
      cascadeResult
    })
  } catch (error: any) {
    console.error("Error deleting product:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

