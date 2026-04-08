import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { organizationInventory, globalProducts, categories, auditLogs } from "@/db/schema"
import { eq, and, ilike, or, desc, sql, isNull, SQL, inArray } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { cascadeOrgStatusChange } from "@/lib/inventory-cascade"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"

// GET /api/v1/head-office/organization-inventory - List products in organization inventory
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "HEAD_OFFICE" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const subCategory = searchParams.get("subCategory") || ""
    const status = searchParams.get("status") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      // For Super Admin, we might be looking at a specific organization
      let orgId = user.organizationId
      if (user.role === "SUPER_ADMIN") {
        const orgIdParam = searchParams.get("organizationId")
        if (orgIdParam) orgId = parseInt(orgIdParam)
      }

      if (!orgId) throw new Error("Organization ID is required")

      const cacheKey = scopedCacheKey('org-inv', { orgId: orgId.toString() }, { search, category, subCategory, status, page, limit })

      return getCached(cacheKey, async () => {
        const conditions: (SQL | undefined)[] = [
          eq(organizationInventory.organizationId, parseInt(orgId)),
          isNull(organizationInventory.deletedAt),
          isNull(globalProducts.deletedAt),
          eq(globalProducts.status, "active"),
        ]


        if (status === "inactive") conditions.push(eq(organizationInventory.isActive, false))
        else if (status !== "all") conditions.push(eq(organizationInventory.isActive, true))

        if (search) {
          conditions.push(or(
            ilike(globalProducts.name, `%${search}%`),
            ilike(globalProducts.productCode, `%${search}%`),
            ilike(organizationInventory.customName, `%${search}%`)
          ))
        }

        if (category && category !== 'all') {
          const catId = parseInt(category)
          const subCatsList = await tx.select({ id: categories.id }).from(categories).where(eq(categories.parentId, catId))
          const subCatIds = subCatsList.map((sc: any) => sc.id)
          conditions.push(subCatIds.length > 0 ? inArray(globalProducts.categoryId, subCatIds) : eq(globalProducts.categoryId, -1))
        }

        if (subCategory && subCategory !== 'all') {
          conditions.push(eq(globalProducts.categoryId, parseInt(subCategory)))
        }

        const subCats = alias(categories, "subCategories")
        const parentCats = alias(categories, "parentCategories")

        const [items, totalResult] = await Promise.all([
          tx.select({
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
            productName: globalProducts.name,
            productCode: globalProducts.productCode,
            productImageUrl: globalProducts.imageUrl,
            basePrice: globalProducts.basePrice,
            unit: globalProducts.unit,
            status: globalProducts.status,
            categoryName: subCats.name,
            parentCategoryName: parentCats.name,
            discountType: globalProducts.discountType,
            discountValue: globalProducts.discountValue,
            discountStartAt: globalProducts.discountStartAt,
            discountEndAt: globalProducts.discountEndAt,
            discountActive: globalProducts.discountActive,
          })
            .from(organizationInventory)
            .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .leftJoin(subCats, eq(globalProducts.categoryId, subCats.id))
            .leftJoin(parentCats, eq(subCats.parentId, parentCats.id))
            .where(and(...conditions))
            .orderBy(desc(organizationInventory.assignedAt))
            .limit(limit)
            .offset(offset),

          tx.select({ count: sql<number>`count(*)` })
            .from(organizationInventory)
            .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .where(and(...conditions)),
        ])

        return { items, total: (totalResult[0] as any).count, page, limit }
      }, CACHE_TTL.INVENTORY)
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error fetching organization inventory:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// PUT /api/v1/head-office/organization-inventory - Update organization-level overrides
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    // Only Super Admin can update org-level overrides in this legacy route? 
    // Wait, original code says SUPER_ADMIN requirement. Correcting to allow HEAD_OFFICE if scoped.
    const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE"]
    if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { id, isActive, customName, customPrice, customDescription, customImageUrl } = body
    if (!id) return NextResponse.json({ error: "Inventory ID is required" }, { status: 400 })

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      // 1. Fetch existing
      const [existingItem] = await tx.select().from(organizationInventory).where(and(eq(organizationInventory.id, parseInt(id)), isNull(organizationInventory.deletedAt))).limit(1)
      if (!existingItem) throw new Error("Inventory item not found or access denied")

      // 2. Prepare update
      const updateData: any = { updatedAt: new Date() }
      if (isActive !== undefined) updateData.isActive = isActive
      if (customName !== undefined) updateData.customName = customName || null
      if (customPrice !== undefined) updateData.customPrice = customPrice ? Math.round(parseFloat(customPrice) * 100) : null
      if (customDescription !== undefined) updateData.customDescription = customDescription || null
      if (customImageUrl !== undefined) updateData.customImageUrl = customImageUrl || null

      // 3. Update
      const [updated] = await tx.update(organizationInventory).set(updateData).where(eq(organizationInventory.id, parseInt(id))).returning()

      // 4. Cascade if status changed
      if (isActive !== undefined && isActive !== (existingItem as any).isActive) {
        await cascadeOrgStatusChange(parseInt(id), isActive, user.id, user.role, tx)

        await tx.insert(auditLogs).values({
          userId: user.id,
          action: "CASCADE_UPDATE",
          entity: "OrganizationInventory",
          entityId: id.toString(),
          metadata: { organizationInventoryId: parseInt(id), isActive, performedByRole: user.role },
        })

        await invalidateByPrefix('branch-inv')
      }

      // 5. Audit
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "UPDATE",
        entity: "OrganizationInventory",
        entityId: id.toString(),
        metadata: { updateData },
      })

      return updated
    })

    await invalidateByPrefix('org-inv')
    return NextResponse.json({ message: "Inventory updated successfully", inventory: result })
  } catch (error: any) {
    console.error("Error updating organization inventory:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 400 })
  }
}


