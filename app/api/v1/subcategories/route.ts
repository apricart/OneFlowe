import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { categories, globalProducts } from "@/db/schema"
import { eq, and, like, desc, sql, isNotNull } from "drizzle-orm"

// GET /api/v1/subcategories - List subcategories with parent filtering
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
    const parentId = searchParams.get("parentId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    // Build where clause
    const conditions = [isNotNull(categories.parentId)]
    if (search) {
      conditions.push(like(categories.name, `%${search}%`))
    }
    if (parentId) {
      conditions.push(eq(categories.parentId, parseInt(parentId)))
    }

    const whereClause = and(...conditions)

    // Fetch subcategories with parent info and counts
    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: categories.id,
          name: categories.name,
          parentId: categories.parentId,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
          parentName: sql<string>`(
            SELECT name 
            FROM ${categories} parent 
            WHERE parent.id = ${categories.parentId}
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
    console.error("Subcategories GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/v1/subcategories - Create new subcategory
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

    if (!parentId) {
      return NextResponse.json({ error: "Parent category ID is required" }, { status: 400 })
    }

    // Validate parent category exists and is a parent category (not subcategory)
    const parentCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parentId))
      .limit(1)

    if (parentCategory.length === 0) {
      return NextResponse.json({ error: "Parent category not found" }, { status: 404 })
    }

    // Check if parent category is actually a parent (not a subcategory)
    if (parentCategory[0].parentId !== null) {
      return NextResponse.json({ error: "Parent category must be a top-level category" }, { status: 400 })
    }

    // Check if subcategory with same name already exists under this parent
    const existingSubcategory = await db
      .select()
      .from(categories)
      .where(and(
        eq(categories.name, name.trim()),
        eq(categories.parentId, parentId)
      ))
      .limit(1)

    if (existingSubcategory.length > 0) {
      return NextResponse.json({ error: "Subcategory with this name already exists under this parent" }, { status: 409 })
    }

    const newSubcategory = await db
      .insert(categories)
      .values({
        name: name.trim(),
        parentId: parentId,
        organizationId: null, // Global subcategories for Super Admin
      })
      .returning()

    return NextResponse.json({ item: newSubcategory[0] }, { status: 201 })
  } catch (error) {
    console.error("Subcategories POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/v1/subcategories - Update subcategory
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
      return NextResponse.json({ error: "Subcategory ID is required" }, { status: 400 })
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    if (!parentId) {
      return NextResponse.json({ error: "Parent category ID is required" }, { status: 400 })
    }

    // Check if subcategory exists
    const existingSubcategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1)

    if (existingSubcategory.length === 0) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 })
    }

    // Validate parent category exists and is a parent category
    const parentCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parentId))
      .limit(1)

    if (parentCategory.length === 0) {
      return NextResponse.json({ error: "Parent category not found" }, { status: 404 })
    }

    if (parentCategory[0].parentId !== null) {
      return NextResponse.json({ error: "Parent category must be a top-level category" }, { status: 400 })
    }

    // Check if another subcategory with same name already exists under this parent
    const duplicateSubcategory = await db
      .select()
      .from(categories)
      .where(and(
        eq(categories.name, name.trim()),
        eq(categories.parentId, parentId),
        sql`${categories.id} != ${id}`
      ))
      .limit(1)

    if (duplicateSubcategory.length > 0) {
      return NextResponse.json({ error: "Subcategory with this name already exists under this parent" }, { status: 409 })
    }

    const updatedSubcategory = await db
      .update(categories)
      .set({
        name: name.trim(),
        parentId: parentId,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning()

    return NextResponse.json({ item: updatedSubcategory[0] })
  } catch (error) {
    console.error("Subcategories PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/v1/subcategories - Delete subcategory
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
      return NextResponse.json({ error: "Subcategory ID is required" }, { status: 400 })
    }

    // Check if subcategory exists
    const existingSubcategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .limit(1)

    if (existingSubcategory.length === 0) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 })
    }

    // Check if subcategory has products
    const products = await db
      .select()
      .from(globalProducts)
      .where(eq(globalProducts.categoryId, parseInt(id)))
      .limit(1)

    if (products.length > 0) {
      return NextResponse.json({ error: "Cannot delete subcategory with products" }, { status: 400 })
    }

    await db
      .delete(categories)
      .where(eq(categories.id, parseInt(id)))

    return NextResponse.json({ message: "Subcategory deleted successfully" })
  } catch (error) {
    console.error("Subcategories DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
