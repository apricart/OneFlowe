export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin, withTenant } from "@/lib/db"
import { categories, globalProducts } from "@/db/schema"
import { eq, and, like, desc, sql, isNull } from "drizzle-orm"
import { escapeLikePattern } from "@/lib/utils"
import { getCached, invalidateByPrefix, CACHE_TTL } from "@/lib/cache-utils"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    if (role !== "SUPER_ADMIN" && role !== "HEAD_OFFICE" && role !== "BRANCH_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const searchRaw = searchParams.get("search") || ""
    const search = searchRaw ? escapeLikePattern(searchRaw) : ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions = [isNull(categories.parentId)]
    if (search) {
      conditions.push(like(categories.name, `%${search}%`))
    }

    const whereClause = and(...conditions)
    const cacheKey = `cache:categories:search=${search}&page=${page}&limit=${limit}`

    const result = await getCached(cacheKey, async () => {
      // Categories are global, use withSuperAdmin for consistent access
      return await withSuperAdmin(async (tx) => {
        const [items, totalResult] = await Promise.all([
          tx
            .select({
              id: categories.id,
              name: categories.name,
              createdAt: categories.createdAt,
              updatedAt: categories.updatedAt,
              subcategoriesCount: sql<number>`(
                SELECT COALESCE(COUNT(*), 0)::int 
                FROM categories sub
                WHERE sub.parent_id = categories.id
              )`,
              productsCount: sql<number>`(
                SELECT COALESCE(COUNT(*), 0)::int 
                FROM global_products gp
                WHERE gp.category_id IN (
                  SELECT sub.id 
                  FROM categories sub 
                  WHERE sub.parent_id = categories.id
                )
              )`,
            })
            .from(categories)
            .where(whereClause)
            .orderBy(desc(categories.createdAt))
            .limit(limit)
            .offset(offset),
          tx
            .select({ count: sql<number>`count(*)` })
            .from(categories)
            .where(whereClause)
        ])

        const total = totalResult[0]?.count || 0
        return {
          items,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        }
      })
    }, CACHE_TTL.STATIC)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Categories GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { name } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const newCategory = await withSuperAdmin(async (tx) => {
      const existing = await tx
        .select()
        .from(categories)
        .where(and(eq(categories.name, name.trim()), isNull(categories.parentId)))
        .limit(1)

      if (existing.length > 0) {
        throw new Error("Category with this name already exists")
      }

      const [created] = await tx
        .insert(categories)
        .values({ name: name.trim(), parentId: null, organizationId: null })
        .returning()

      return created
    })

    await invalidateByPrefix('categories')
    await invalidateByPrefix('subcategories')

    return NextResponse.json({ item: newCategory }, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("Categories POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { id, name, parentId } = body

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updatedCategory = await withSuperAdmin(async (tx) => {
      const existing = await tx.select().from(categories).where(eq(categories.id, id)).limit(1)
      if (existing.length === 0) throw new Error("Category not found")

      const duplicate = await tx
        .select()
        .from(categories)
        .where(and(
          eq(categories.name, name.trim()),
          parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
          sql`${categories.id} != ${id}`
        ))
        .limit(1)

      if (duplicate.length > 0) throw new Error("Category with this name already exists")

      if (parentId) {
        const parent = await tx.select().from(categories).where(eq(categories.id, parentId)).limit(1)
        if (parent.length === 0) throw new Error("Parent category not found")
        if (parentId === id) throw new Error("Category cannot be its own parent")
      }

      const [updated] = await tx
        .update(categories)
        .set({ name: name.trim(), parentId: parentId || null, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning()

      return updated
    })

    await invalidateByPrefix('categories')
    await invalidateByPrefix('subcategories')

    return NextResponse.json({ item: updatedCategory })
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('already exists') || error.message?.includes('own parent')) {
      const status = error.message.includes('not found') ? 404 : error.message.includes('already exists') ? 409 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    console.error("Categories PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    await withSuperAdmin(async (tx) => {
      const existing = await tx.select().from(categories).where(eq(categories.id, parseInt(id))).limit(1)
      if (existing.length === 0) throw new Error("Category not found")

      const subcategoryCount = await tx
        .select({ count: sql<number>`count(*)` })
        .from(categories)
        .where(eq(categories.parentId, parseInt(id)))

      const subCount = subcategoryCount[0]?.count || 0
      if (subCount > 0) {
        throw new Error(`Cannot delete category with ${subCount} subcategor${subCount > 1 ? 'ies' : 'y'}. Remove subcategories first.`)
      }

      const productCount = await tx
        .select({ count: sql<number>`count(*)` })
        .from(globalProducts)
        .where(eq(globalProducts.categoryId, parseInt(id)))

      const prodCount = productCount[0]?.count || 0
      if (prodCount > 0) {
        throw new Error(`Cannot delete category with ${prodCount} product${prodCount > 1 ? 's' : ''} directly assigned.`)
      }

      await tx.delete(categories).where(eq(categories.id, parseInt(id)))
    })

    await invalidateByPrefix('categories')
    await invalidateByPrefix('subcategories')

    return NextResponse.json({ message: "Category deleted successfully" })
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message?.includes('Cannot delete')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Categories DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
