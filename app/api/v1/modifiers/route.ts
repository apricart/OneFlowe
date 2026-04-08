import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin } from "@/lib/db"
import { modifiers, productModifiers } from "@/db/schema"
import { eq, and, like, or, desc, sql } from "drizzle-orm"
import { escapeLikePattern } from "@/lib/utils"

export async function GET(req: NextRequest) {
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
    const searchRaw = searchParams.get("search") || ""
    const search = searchRaw ? escapeLikePattern(searchRaw) : ""
    const type = searchParams.get("type") || ""
    const status = searchParams.get("status") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions: any[] = []
    if (search) {
      conditions.push(or(like(modifiers.name, `%${search}%`), like(modifiers.description, `%${search}%`)))
    }
    if (type) conditions.push(eq(modifiers.type, type))
    if (status) conditions.push(eq(modifiers.status, status))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [items, totalResult] = await withSuperAdmin(async (tx) => {
      return Promise.all([
        tx
          .select({
            id: modifiers.id,
            name: modifiers.name,
            description: modifiers.description,
            type: modifiers.type,
            status: modifiers.status,
            createdAt: modifiers.createdAt,
            updatedAt: modifiers.updatedAt,
            usageCount: sql<number>`(
              SELECT COUNT(*)::int 
              FROM ${productModifiers} 
              WHERE modifier_id = ${modifiers.id}
            )`,
          })
          .from(modifiers)
          .where(whereClause)
          .orderBy(desc(modifiers.createdAt))
          .limit(limit)
          .offset(offset),
        tx
          .select({ count: sql<number>`count(*)` })
          .from(modifiers)
          .where(whereClause)
      ])
    }) as any

    const total = totalResult[0]?.count || 0

    return NextResponse.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Modifiers GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole, id: userId } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, type, status } = body

    if (!name || name.trim().length === 0) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    if (!type || type.trim().length === 0) return NextResponse.json({ error: "Type is required" }, { status: 400 })

    const newModifier = await withSuperAdmin(async (tx) => {
      const existing = await tx
        .select()
        .from(modifiers)
        .where(and(eq(modifiers.name, name.trim()), eq(modifiers.type, type.trim())))
        .limit(1)

      if (existing.length > 0) throw new Error("Modifier with this name and type already exists")

      const [created] = await tx
        .insert(modifiers)
        .values({
          name: name.trim(),
          description: description?.trim() || null,
          type: type.trim(),
          status: status || "active",
          createdByUserId: userId,
        })
        .returning()

      return created
    })

    return NextResponse.json({ item: newModifier }, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('already exists')) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error("Modifiers POST error:", error)
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
    const { id, name, description, type, status } = body

    if (!id) return NextResponse.json({ error: "Modifier ID is required" }, { status: 400 })
    if (!name || name.trim().length === 0) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    if (!type || type.trim().length === 0) return NextResponse.json({ error: "Type is required" }, { status: 400 })

    const updatedModifier = await withSuperAdmin(async (tx) => {
      const existing = await tx.select().from(modifiers).where(eq(modifiers.id, id)).limit(1)
      if (existing.length === 0) throw new Error("Modifier not found")

      const duplicate = await tx
        .select()
        .from(modifiers)
        .where(and(eq(modifiers.name, name.trim()), eq(modifiers.type, type.trim()), sql`${modifiers.id} != ${id}`))
        .limit(1)

      if (duplicate.length > 0) throw new Error("Modifier with this name and type already exists")

      const [updated] = await tx
        .update(modifiers)
        .set({ name: name.trim(), description: description?.trim() || null, type: type.trim(), status: status || "active", updatedAt: new Date() })
        .where(eq(modifiers.id, id))
        .returning()

      return updated
    })

    return NextResponse.json({ item: updatedModifier })
  } catch (error: any) {
    if (error.message?.includes('not found')) return NextResponse.json({ error: error.message }, { status: 404 })
    if (error.message?.includes('already exists')) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error("Modifiers PUT error:", error)
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
    if (!id) return NextResponse.json({ error: "Modifier ID is required" }, { status: 400 })

    await withSuperAdmin(async (tx) => {
      const existing = await tx.select().from(modifiers).where(eq(modifiers.id, parseInt(id))).limit(1)
      if (existing.length === 0) throw new Error("Modifier not found")

      const usage = await tx.select().from(productModifiers).where(eq(productModifiers.modifierId, parseInt(id))).limit(1)
      if (usage.length > 0) throw new Error("Cannot delete modifier that is being used by products")

      await tx.delete(modifiers).where(eq(modifiers.id, parseInt(id)))
    })

    return NextResponse.json({ message: "Modifier deleted successfully" })
  } catch (error: any) {
    if (error.message?.includes('not found')) return NextResponse.json({ error: error.message }, { status: 404 })
    if (error.message?.includes('Cannot delete')) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error("Modifiers DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
