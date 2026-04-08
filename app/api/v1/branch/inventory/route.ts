import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { branchInventory, globalProducts, organizationInventory, categories, auditLogs } from "@/db/schema"
import { eq, and, ilike, or, desc, sql, isNull, SQL, inArray } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { escapeLikePattern } from "@/lib/utils"
import { getCached, scopedCacheKey } from "@/lib/cache-utils"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user as any
    const { searchParams } = new URL(req.url)

    let organizationId = user.organizationId
    let branchId = user.branchId

    if (user.role === "HEAD_OFFICE" || user.role === "SUPER_ADMIN") {
      const branchIdParam = searchParams.get("branchId")
      const orgIdParam = searchParams.get("organizationId")

      if (branchIdParam) branchId = parseInt(branchIdParam)
      if (orgIdParam) organizationId = parseInt(orgIdParam)
    }

    if (!branchId || !organizationId) {
      return NextResponse.json({ error: "Branch or organization context missing" }, { status: 400 })
    }

    const searchRaw = searchParams.get("search") || ""
    const search = searchRaw ? escapeLikePattern(searchRaw) : ""
    const category = searchParams.get("category") || ""
    const subCategory = searchParams.get("subCategory") || ""
    const pageNum = Math.max(1, parseInt(searchParams.get("page") || "1") || 1)
    const limitNum = Math.max(1, parseInt(searchParams.get("limit") || "50") || 50)
    const offset = (pageNum - 1) * limitNum

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const cacheKey = scopedCacheKey('branch-inv', { branchId, orgId: organizationId }, {
      search, category, subCategory, page: pageNum, limit: limitNum
    })

    const results = await getCached(cacheKey, async () => {
      return await runner(async (tx: any) => {
        const conditions: (SQL | undefined)[] = [
          eq(branchInventory.branchId, branchId),
          eq(branchInventory.organizationId, organizationId),
          isNull(branchInventory.deletedAt),
          eq(globalProducts.status, "active"),
          eq(organizationInventory.isActive, true),
        ]

        if (search) {
          conditions.push(
            or(
              ilike(globalProducts.name, `%${search}%`),
              ilike(globalProducts.productCode, `%${search}%`),
              ilike(organizationInventory.customName, `%${search}%`)
            )
          )
        }

        if (category && category !== 'all') {
          const catId = parseInt(category)
          const subCatsList = await tx.select({ id: categories.id })
            .from(categories)
            .where(eq(categories.parentId, catId))
          const subCatIds = subCatsList.map((sc: any) => sc.id)
          if (subCatIds.length > 0) {
            conditions.push(inArray(globalProducts.categoryId, subCatIds))
          } else {
            conditions.push(eq(globalProducts.categoryId, -1))
          }
        }

        if (subCategory && subCategory !== 'all') {
          conditions.push(eq(globalProducts.categoryId, parseInt(subCategory)))
        }

        const subCats = alias(categories, "subCategories")
        const parentCats = alias(categories, "parentCategories")

        const [items, totalResult] = await Promise.all([
          tx.select({
            id: branchInventory.id,
            branchId: branchInventory.branchId,
            organizationId: branchInventory.organizationId,
            organizationInventoryId: branchInventory.organizationInventoryId,
            isVisible: branchInventory.isVisible,
            isActive: branchInventory.isActive,
            stockQuantity: globalProducts.stockQuantity,
            reorderThreshold: sql<number>`10`,
            assignedAt: branchInventory.assignedAt,
            updatedAt: branchInventory.updatedAt,
            productName: globalProducts.name,
            productCode: globalProducts.productCode,
            productImageUrl: globalProducts.imageUrl,
            basePrice: globalProducts.basePrice,
            unit: globalProducts.unit,
            status: globalProducts.status,
            productDescription: globalProducts.description,
            categoryName: subCats.name,
            parentCategoryName: parentCats.name,
            customName: organizationInventory.customName,
            customPrice: organizationInventory.customPrice,
          })
          .from(branchInventory)
          .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
          .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
          .leftJoin(subCats, eq(globalProducts.categoryId, subCats.id))
          .leftJoin(parentCats, eq(subCats.parentId, parentCats.id))
          .where(and(...conditions))
          .limit(limitNum)
          .offset(offset)
          .orderBy(desc(branchInventory.assignedAt)),

          tx.select({ count: sql<number>`count(*)::int` })
            .from(branchInventory)
            .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
            .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .where(and(...conditions))
        ])

        return { items, total: totalResult[0]?.count || 0 }
      })
    })

    return NextResponse.json({
      items: (results as any).items,
      meta: {
        total: (results as any).total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((results as any).total / limitNum)
      }
    })
  } catch (error: any) {
    console.error("[BRANCH_INVENTORY_GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch branch inventory" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user as { id: string; role: string; organizationId: number; branchId: number }
    const body = await req.json()
    const { id, isVisible, isActive } = body

    if (!id) {
      return NextResponse.json({ error: "Inventory ID required" }, { status: 400 })
    }

    const result = await withTenant(user, async (tx) => {
      const [existing] = await tx
        .select()
        .from(branchInventory)
        .where(and(
          eq(branchInventory.id, id),
          user.role === "BRANCH_ADMIN" ? eq(branchInventory.branchId, user.branchId) : undefined
        ))
        .limit(1)

      if (!existing) {
        throw new Error("Inventory item not found")
      }

      const updates: any = { updatedAt: new Date() }
      if (isVisible !== undefined) updates.isVisible = isVisible
      if (isActive !== undefined) updates.isActive = isActive

      const [updated] = await tx
        .update(branchInventory)
        .set(updates)
        .where(eq(branchInventory.id, id))
        .returning()

      await tx.insert(auditLogs).values({
        userId: user.id,
        organizationId: user.organizationId,
        action: "UPDATE_BRANCH_INVENTORY",
        entity: "BRANCH_INVENTORY",
        entityId: String(id),
        metadata: { updates }
      })

      return updated
    })

    return NextResponse.json({ success: true, item: result })
  } catch (error: any) {
    console.error("[BRANCH_INVENTORY_POST] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to update branch inventory" }, { status: 500 })
  }
}
