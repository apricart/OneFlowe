import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { categories, globalProducts } from "@/db/schema"
import { eq, and, like, or, desc, sql, isNull, isNotNull } from "drizzle-orm"

// GET /api/v1/categories - List all categories with optional filtering
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
    const type = searchParams.get("type") || "all" // all, parent, subcategory
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    // Build where clause
    const conditions = []
    if (search) {
      conditions.push(like(categories.name, `%${search}%`))
    }
    if (type === "parent") {
      conditions.push(isNull(categories.parentId))
    } else if (type === "subcategory") {
      conditions.push(isNotNull(categories.parentId))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Fetch categories with counts
    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: categories.id,
          name: categories.name,
          parentId: categories.parentId,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
          subCategoriesCount: sql<number>`(
            SELECT COUNT(*)::int 
            FROM ${categories} sub 
            WHERE sub.parent_id = ${categories.id}
          )`,
          productsCount: sql<number>`(
            SELECT COUNT(*)::int 
            FROM ${globalProducts} 
            WHERE category_id = ${categories.id}
          )`,
        })
        .from(categories)
        .where(whereClause)
        .orderBy(desc(categories.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(categories)
        .where(whereClause)
    ])

    const total = totalResult[0]?.count || 0

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Categories GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/v1/categories - Create new category
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
    const { name, parentId, description } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if category with same name already exists
    const existingCategory = await db
      .select()
      .from(categories)
      .where(and(
        eq(categories.name, name.trim()),
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId)
      ))
      .limit(1)

    if (existingCategory.length > 0) {
      return NextResponse.json({ error: "Category with this name already exists" }, { status: 409 })
    }

    // Validate parent category exists if parentId is provided
    if (parentId) {
      const parentCategory = await db
        .select()
        .from(categories)
        .where(eq(categories.id, parentId))
        .limit(1)

      if (parentCategory.length === 0) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 404 })
      }
    }

    const newCategory = await db
      .insert(categories)
      .values({
        name: name.trim(),
        parentId: parentId || null,
        organizationId: null, // Global categories for Super Admin
      })
      .returning()

    return NextResponse.json({ item: newCategory[0] }, { status: 201 })
  } catch (error) {
    console.error("Categories POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/v1/categories - Update category
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
    const { id, name, parentId, description } = body

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if category exists
    const existingCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1)

    if (existingCategory.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Check if another category with same name already exists
    const duplicateCategory = await db
      .select()
      .from(categories)
      .where(and(
        eq(categories.name, name.trim()),
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
        sql`${categories.id} != ${id}`
      ))
      .limit(1)

    if (duplicateCategory.length > 0) {
      return NextResponse.json({ error: "Category with this name already exists" }, { status: 409 })
    }

    // Validate parent category exists if parentId is provided
    if (parentId) {
      const parentCategory = await db
        .select()
        .from(categories)
        .where(eq(categories.id, parentId))
        .limit(1)

      if (parentCategory.length === 0) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 404 })
      }

      // Prevent circular reference
      if (parentId === id) {
        return NextResponse.json({ error: "Category cannot be its own parent" }, { status: 400 })
      }
    }

    const updatedCategory = await db
      .update(categories)
      .set({
        name: name.trim(),
        parentId: parentId || null,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning()

    return NextResponse.json({ item: updatedCategory[0] })
  } catch (error) {
    console.error("Categories PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/v1/categories - Soft delete category
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
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    // Check if category exists
    const existingCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .limit(1)

    if (existingCategory.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Check if category has subcategories
    const subcategories = await db
      .select()
      .from(categories)
      .where(eq(categories.parentId, parseInt(id)))
      .limit(1)

    if (subcategories.length > 0) {
      return NextResponse.json({ error: "Cannot delete category with subcategories" }, { status: 400 })
    }

    // Check if category has products
    const products = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.categoryId, parseInt(id)))
      .limit(1)

    if (products.length > 0) {
      return NextResponse.json({ error: "Cannot delete category with products" }, { status: 400 })
    }

    await db
      .delete(categories)
      .where(eq(categories.id, parseInt(id)))

    return NextResponse.json({ message: "Category deleted successfully" })
  } catch (error) {
    console.error("Categories DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
