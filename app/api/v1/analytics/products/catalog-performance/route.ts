import { NextResponse, type NextRequest } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, orderItems, branches, globalProducts, categories, organizationInventory, branchInventory } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc, isNull, sql, exists, or, isNotNull } from "drizzle-orm"
import { getCached, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const startDateParam = url.searchParams.get("startDate")
    const endDateParam = url.searchParams.get("endDate")
    const branchIdsParam = url.searchParams.get("branchIds")
    const groupIdsRaw = url.searchParams.get("groupIds")
    const organizationIdsRaw = url.searchParams.get("organizationIds")
    const productIdsRaw = url.searchParams.get("productIds")

    const monthsRaw = url.searchParams.get("months")
    const yearsRaw = url.searchParams.get("years")

    const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []
    const parsedGroupIds = groupIdsRaw ? groupIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []
    const parsedOrganizationIds = organizationIdsRaw ? organizationIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []
    const parsedProductIds = productIdsRaw ? productIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []

    let branchIds: number[] = []
    if (branchIdsParam) {
      branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
    } else if (["BRANCH_ADMIN", "BRANCH_MANAGER", "ORDER_PORTAL"].includes(scope.role)) {
      branchIds = [scope.branchId as number]
    }

    let startDate = startDateParam ? new Date(startDateParam) : undefined
    let endDate = endDateParam ? new Date(endDateParam) : undefined
    if (startDate) startDate.setHours(0, 0, 0, 0)
    if (endDate) endDate.setHours(23, 59, 59, 999)

    const cacheKey = scopedCacheKey('analytics:catalog-performance', {
      orgId: scope.organizationId as number,
      role: scope.role
    }, {
      branchIds: branchIds.join(','),
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      months: parsedMonths.join(','),
      years: parsedYears.join(','),
      productIds: parsedProductIds.join(','),
      groupIds: parsedGroupIds.join(','),
      organizationIds: parsedOrganizationIds.join(',')
    })

    const result = await getCached(cacheKey, async () => {
      return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

      async function handler(tx: any) {
        if (parsedGroupIds.length > 0) {
          const groupBranches = await tx.select({ id: branches.id }).from(branches).where(inArray(branches.groupId, parsedGroupIds))
          const groupBranchIds = groupBranches.map((b: any) => b.id)
          branchIds = branchIds.length > 0 ? branchIds.filter(id => groupBranchIds.includes(id)) : groupBranchIds
        }

        const productConditions: any[] = []
        if (parsedProductIds.length > 0) productConditions.push(inArray(globalProducts.id, parsedProductIds))

        if (branchIds.length > 0) {
          productConditions.push(exists(tx.select().from(branchInventory).innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id)).where(and(eq(organizationInventory.globalProductId, globalProducts.id), inArray(branchInventory.branchId, branchIds)))))
        } else if (parsedOrganizationIds.length > 0) {
          productConditions.push(exists(tx.select().from(organizationInventory).where(and(eq(organizationInventory.globalProductId, globalProducts.id), inArray(organizationInventory.organizationId, parsedOrganizationIds), or(isNull(organizationInventory.deletedAt), isNotNull(globalProducts.deletedAt))))))
        }

        const targetOrgId = parsedOrganizationIds.length === 1 ? parsedOrganizationIds[0] : scope.organizationId
        const allProducts = await tx.select({
          id: globalProducts.id,
          productCode: globalProducts.productCode,
          name: globalProducts.name,
          unit: globalProducts.unit,
          status: globalProducts.status,
          basePrice: globalProducts.basePrice,
          stockQuantity: globalProducts.stockQuantity,
          categoryId: globalProducts.categoryId,
          customPrice: organizationInventory.customPrice,
          customName: organizationInventory.customName,
          deletedAt: globalProducts.deletedAt,
          organizationIsActive: organizationInventory.isActive,
        })
        .from(globalProducts)
        .leftJoin(organizationInventory, and(eq(organizationInventory.globalProductId, globalProducts.id), targetOrgId ? eq(organizationInventory.organizationId, targetOrgId) : sql`FALSE`))
        .where(and(...productConditions))
        .orderBy(desc(globalProducts.id))

        const categoriesMap = new Map()
        const cats = await tx.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories)
        cats.forEach((c: any) => categoriesMap.set(c.id, c))

        let salesBranchIds = branchIds
        if (salesBranchIds.length === 0 && scope.organizationId) {
          const orgBranches = await tx.select({ id: branches.id }).from(branches).where(eq(branches.organizationId, scope.organizationId))
          salesBranchIds = orgBranches.map((b: any) => b.id)
        }

        const baseConditions: any[] = [
          salesBranchIds.length > 0 ? inArray(orders.branchId, salesBranchIds) : sql`TRUE`,
          sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')`,
          parsedProductIds.length > 0 ? inArray(orderItems.globalProductId, parsedProductIds) : sql`TRUE`
        ]

        if (parsedMonths.length > 0) baseConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
        if (parsedYears.length > 0) baseConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
        if (parsedMonths.length === 0 && parsedYears.length === 0) {
          if (startDate) baseConditions.push(gte(orders.createdAt, startDate))
          if (endDate) baseConditions.push(lte(orders.createdAt, endDate))
        }

        const salesData = await tx
          .select({
            globalProductId: orderItems.globalProductId,
            totalQtyOrdered: sql<number>`SUM(${orderItems.quantity})::int`,
            totalQtyFulfilled: sql<number>`SUM(COALESCE(${orderItems.quantity}, 0))::int`, 
            totalRevenueCents: sql<number>`SUM(COALESCE(${orderItems.quantity}, 0) * COALESCE(${orderItems.priceCents}, 0))::bigint`
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .where(and(...baseConditions))
          .groupBy(orderItems.globalProductId)

        const salesMap = new Map()
        salesData.forEach((s: any) => salesMap.set(s.globalProductId, s))

        const data = allProducts.map((p: any) => {
          const s = salesMap.get(p.id) || { totalQtyOrdered: 0, totalQtyFulfilled: 0, totalRevenueCents: 0 }
          const catInfo = categoriesMap.get(p.categoryId)
          const parentCatInfo = catInfo?.parentId ? categoriesMap.get(catInfo.parentId) : null
          return {
            globalProductId: p.id,
            productCode: p.productCode,
            productName: p.customName || p.name,
            unit: p.unit,
            status: p.deletedAt ? "deleted" : (p.organizationIsActive === false ? "inactive" : p.status),
            basePriceCents: scope.role === "SUPER_ADMIN" ? (p.basePrice || 0) : 0,
            unitPriceCents: p.customPrice || p.basePrice,
            stockQuantity: p.stockQuantity,
            categoryName: catInfo?.name || "Uncategorized",
            subCategoryName: parentCatInfo ? catInfo?.name : "",
            qtyOrdered: s.totalQtyOrdered,
            qtyFulfilled: s.totalQtyFulfilled,
            revenueGeneratedCents: Number(s.totalRevenueCents || 0),
          }
        })

        return { data }
      }
    }, CACHE_TTL.ANALYTICS)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
