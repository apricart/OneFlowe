export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin } from "@/lib/db"
import { categories, globalProducts } from "@/db/schema"
import { eq, and, like, desc, sql, isNotNull } from "drizzle-orm"
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
    const search = searchParams.get("search") || ""
    const categoryId = searchParams.get("categoryId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions: any[] = [isNotNull(categories.parentId)]

    if (search) {
      const { escapeLikePattern } = await import("@/lib/utils")
      conditions.push(like(categories.name, `%${escapeLikePattern(search)}%`))
    }

    if (categoryId) {
      conditions.push(eq(categories.parentId, parseInt(categoryId)))
    }

    const whereClause = and(...conditions)
    const cacheKey = `cache:subcategories:search=${search}&cat=${categoryId || ''}&page=${page}&limit=${limit}`

    const result = await getCached(cacheKey, async () => {
      return await withSuperAdmin(async (tx) => {
        const [items, totalResult] = await Promise.all([
          tx
            .select({
              id: categories.id,
              name: categories.name,
              parentId: categories.parentId,
              createdAt: categories.createdAt,
              updatedAt: categories.updatedAt,
              productsCount: sql<number>`(
                SELECT COALESCE(COUNT(*), 0)::int 
                FROM global_products gp
                WHERE gp.category_id = categories.id
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

        const parentIds = [...new Set(items.map(item => item.parentId).filter(Boolean))] as number[]
        let parentCategories: { id: number; name: string }[] = []

        if (parentIds.length > 0) {
          parentCategories = await tx
            .select({ id: categories.id, name: categories.name })
            .from(categories)
            .where(sql`${categories.id} IN (${sql.join(parentIds.map(id => sql`${id}`), sql`, `)})`)
        }

        const parentMap = new Map(parentCategories.map(c => [c.id, c.name]))

        const enrichedItems = items.map(item => ({
          ...item,
          categoryName: item.parentId ? parentMap.get(item.parentId) || "Unknown" : null,
        }))

        const total = totalResult[0]?.count || 0

        return {
          items: enrichedItems,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        }
      })
    }, CACHE_TTL.SETTINGS)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Subcategories GET error:", error)
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
    const { name, categoryId } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Subcategory name is required" }, { status: 400 })
    }
    if (!categoryId) {
      return NextResponse.json({ error: "Parent category is required" }, { status: 400 })
    }

    const newSubcategory = await withSuperAdmin(async (tx) => {
      const parent = await tx.select().from(categories).where(eq(categories.id, categoryId)).limit(1)
      if (parent.length === 0) throw new Error("Parent category not found")

      const existing = await tx
        .select()
        .from(categories)
        .where(and(eq(categories.name, name.trim()), eq(categories.parentId, categoryId)))
        .limit(1)

      if (existing.length > 0) throw new Error("Subcategory with this name already exists in this category")

      const [created] = await tx
        .insert(categories)
        .values({ name: name.trim(), parentId: categoryId, organizationId: null })
        .returning()

      return created
    })

    await invalidateByPrefix('subcategories')
    await invalidateByPrefix('categories')

    return NextResponse.json({ item: newSubcategory }, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message?.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("Subcategories POST error:", error)
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
    const { id, name, categoryId } = body

    if (!id) return NextResponse.json({ error: "Subcategory ID is required" }, { status: 400 })
    if (!name || name.trim().length === 0) return NextResponse.json({ error: "Subcategory name is required" }, { status: 400 })

    const updated = await withSuperAdmin(async (tx) => {
      const existing = await tx.select().from(categories).where(eq(categories.id, id)).limit(1)
      if (existing.length === 0) throw new Error("Subcategory not found")

      const duplicate = await tx
        .select()
        .from(categories)
        .where(and(
          eq(categories.name, name.trim()),
          eq(categories.parentId, categoryId || existing[0].parentId),
          sql`${categories.id} != ${id}`
        ))
        .limit(1)

      if (duplicate.length > 0) throw new Error("Subcategory with this name already exists")

      const updateData: any = { name: name.trim(), updatedAt: new Date() }
      if (categoryId) updateData.parentId = categoryId

      const [result] = await tx.update(categories).set(updateData).where(eq(categories.id, id)).returning()
      return result
    })

    await invalidateByPrefix('subcategories')
    await invalidateByPrefix('categories')

    return NextResponse.json({ item: updated })
  } catch (error: any) {
    if (error.message?.includes('not found')) return NextResponse.json({ error: error.message }, { status: 404 })
    if (error.message?.includes('already exists')) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error("Subcategories PUT error:", error)
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
    if (!id) return NextResponse.json({ error: "Subcategory ID is required" }, { status: 400 })

    await withSuperAdmin(async (tx) => {
      const existing = await tx.select().from(categories).where(eq(categories.id, parseInt(id))).limit(1)
      if (existing.length === 0) throw new Error("Subcategory not found")

      const products = await tx
        .select({ count: sql<number>`count(*)` })
        .from(globalProducts)
        .where(eq(globalProducts.categoryId, parseInt(id)))

      const productCount = products[0]?.count || 0
      if (productCount > 0) {
        throw new Error(`Cannot delete subcategory with ${productCount} product${productCount > 1 ? 's' : ''} assigned. Remove products first.`)
      }

      await tx.delete(categories).where(eq(categories.id, parseInt(id)))
    })

    await invalidateByPrefix('subcategories')
    await invalidateByPrefix('categories')

    return NextResponse.json({ message: "Subcategory deleted successfully" })
  } catch (error: any) {
    if (error.message?.includes('not found')) return NextResponse.json({ error: error.message }, { status: 404 })
    if (error.message?.includes('Cannot delete')) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error("Subcategories DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
