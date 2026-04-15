export const dynamic = 'force-dynamic'
import { NextResponse, type NextRequest } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, orderItems, branches, globalProducts, categories, refundItems, refunds, organizationInventory, branchInventory } from "@/db/schema"
import { and, eq, gte, lte, inArray, isNull, sql, exists, desc } from "drizzle-orm"
import { aliasedTable } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const startDateParam = url.searchParams.get("startDate")
    const endDateParam = url.searchParams.get("endDate")
    const branchIdsParam = url.searchParams.get("branchIds")
    const compare = url.searchParams.get("compare") === "true"
    const compareStartDateParam = url.searchParams.get("compareStartDate")
    const compareEndDateParam = url.searchParams.get("compareEndDate")

    const monthsRaw = url.searchParams.get("months")
    const yearsRaw = url.searchParams.get("years")
    const compareMonthsRaw = url.searchParams.get("compareMonths")
    const compareYearsRaw = url.searchParams.get("compareYears")

    const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []
    const parsedCompMonths = compareMonthsRaw ? compareMonthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedCompYears = compareYearsRaw ? compareYearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []

    const groupIdsRaw = url.searchParams.get("groupIds")
    const parsedGroupIds = groupIdsRaw ? groupIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []

    const productIdsRaw = url.searchParams.get("productIds")
    const parsedProductIds = productIdsRaw ? productIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []

    const organizationIdsRaw = url.searchParams.get("organizationIds")
    const parsedOrgIds = organizationIdsRaw ? organizationIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []

    return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      // 1. Resolve Branch IDs
      let branchIds: number[] = []
      if (branchIdsParam) {
        branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
      } else if (["BRANCH_ADMIN", "BRANCH_MANAGER", "ORDER_PORTAL"].includes(scope!.role)) {
        branchIds = [scope!.branchId as number]
      } else {
        const b = await tx.select({ id: branches.id }).from(branches)
          .where(parsedOrgIds.length > 0 ? inArray(branches.organizationId, parsedOrgIds) : (scope!.organizationId ? eq(branches.organizationId, scope!.organizationId) : undefined))
        branchIds = b.map((br: any) => br.id)
      }

      if (parsedGroupIds.length > 0) {
        const groupBranches = await tx.select({ id: branches.id }).from(branches)
          .where(and(
            inArray(branches.groupId, parsedGroupIds),
            parsedOrgIds.length > 0 ? inArray(branches.organizationId, parsedOrgIds) : (scope!.organizationId ? eq(branches.organizationId, scope!.organizationId) : undefined)
          ))
        const groupBranchIds = new Set(groupBranches.map((b: any) => b.id))
        branchIds = branchIds.filter(id => groupBranchIds.has(id))
      }

      if (branchIds.length === 0) return NextResponse.json({ error: "No branches resolved" }, { status: 400 })

      // 2. Date Constraints
      let startDate = startDateParam ? new Date(startDateParam) : undefined
      let endDate = endDateParam ? new Date(endDateParam) : undefined
      if (startDate) startDate.setHours(0, 0, 0, 0)
      if (endDate) endDate.setHours(23, 59, 59, 999)

      const baseConditions: any[] = [
        inArray(orders.branchId, branchIds),
        sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')`
      ]

      if (parsedProductIds.length > 0) baseConditions.push(inArray(globalProducts.id, parsedProductIds))
      if (parsedMonths.length > 0) baseConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
      if (parsedYears.length > 0) baseConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
      if (parsedMonths.length === 0 && parsedYears.length === 0) {
        if (startDate) baseConditions.push(gte(orders.createdAt, startDate))
        if (endDate) baseConditions.push(lte(orders.createdAt, endDate))
      }

      // 3. Main Data Fetch
      const results = await tx
        .select({
          orderId: orders.id,
          status: orders.status,
          createdAt: orders.createdAt,
          globalProductId: orderItems.globalProductId,
          itemCode: globalProducts.productCode,
          itemName: globalProducts.name,
          itemUnit: globalProducts.unit,
          categoryName: categories.name,
          qtyOrdered: orderItems.quantity,
          priceCents: orderItems.priceCents,
          basePriceCents: globalProducts.basePrice,
          orderItemId: orderItems.id
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(globalProducts, eq(orderItems.globalProductId, globalProducts.id))
        .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
        .where(and(...baseConditions))

      // 4. Refunds & Metadata
      const validOrderItemIds = results.map((r: any) => r.orderItemId)
      let refundQuantities: Record<number, number> = {}

      if (validOrderItemIds.length > 0) {
        const refundsObj = await tx
          .select({ orderItemId: refundItems.orderItemId, qty: refundItems.quantity })
          .from(refundItems)
          .innerJoin(refunds, eq(refundItems.refundId, refunds.id))
          .where(and(
            inArray(refundItems.orderItemId, validOrderItemIds),
            inArray(sql`UPPER(${refunds.status})`, ['APPROVED', 'COMPLETED'])
          ))

        refundQuantities = refundsObj.reduce((acc: any, curr: any) => {
          if (curr.orderItemId) acc[curr.orderItemId] = (acc[curr.orderItemId] || 0) + curr.qty
          return acc
        }, {})
      }

      const parentCategories = aliasedTable(categories, 'parentCategories')
      const productConditions: any[] = []
      if (parsedProductIds.length > 0) productConditions.push(inArray(globalProducts.id, parsedProductIds))

      // SECURITY: Restricted roles (BRANCH_ADMIN, etc.) MUST have branchIds set
      // If branchIds is empty for these roles, return empty result to prevent data leak
      const restrictedRoles = ["BRANCH_ADMIN", "BRANCH_MANAGER", "ORDER_PORTAL"]
      if (restrictedRoles.includes(scope!.role)) {
        if (branchIds.length === 0) {
          return NextResponse.json({ items: [], total: 0, _meta: { branchFiltered: true, role: scope!.role } })
        }
        // Force product filter to only show products available in their branch
        productConditions.push(exists(tx.select().from(branchInventory).innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id)).where(and(eq(organizationInventory.globalProductId, globalProducts.id), inArray(branchInventory.branchId, branchIds)))))
      } else if (branchIds.length > 0) {
        // For non-restricted roles with branch filter
        productConditions.push(exists(tx.select().from(branchInventory).innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id)).where(and(eq(organizationInventory.globalProductId, globalProducts.id), inArray(branchInventory.branchId, branchIds)))))
      } else if (parsedOrgIds.length > 0) {
        productConditions.push(exists(tx.select().from(organizationInventory).where(and(eq(organizationInventory.globalProductId, globalProducts.id), inArray(organizationInventory.organizationId, parsedOrgIds)))))
      } else if (scope?.organizationId) {
        productConditions.push(exists(tx.select().from(organizationInventory).where(and(eq(organizationInventory.globalProductId, globalProducts.id), eq(organizationInventory.organizationId, scope.organizationId)))))
      }

      const allProducts = await tx
        .select({
          id: globalProducts.id,
          productCode: globalProducts.productCode,
          name: globalProducts.name,
          unit: globalProducts.unit,
          status: globalProducts.status,
          deletedAt: globalProducts.deletedAt,
          orgIsActive: organizationInventory.isActive,
          categoryName: sql<string>`COALESCE(${parentCategories.name}, ${categories.name})`,
          subCategoryName: sql<string>`CASE WHEN ${parentCategories.id} IS NOT NULL THEN ${categories.name} ELSE NULL END`,
          basePriceCents: globalProducts.basePrice
        })
        .from(globalProducts)
        .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
        .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
        .leftJoin(organizationInventory, and(
          eq(organizationInventory.globalProductId, globalProducts.id),
          parsedOrgIds.length > 0 ? inArray(organizationInventory.organizationId, parsedOrgIds) : (scope?.organizationId ? eq(organizationInventory.organizationId, scope.organizationId) : undefined)
        ))
        .where(and(...productConditions))

      const productMap: Record<number, any> = {}
      allProducts.forEach((p: any) => {
        productMap[p.id] = {
          productId: p.id,
          productCode: p.productCode || 'Unknown',
          productName: p.name,
          unit: p.unit,
          category: p.categoryName || 'Uncategorized',
          subCategory: p.subCategoryName || '-',
          status: p.deletedAt ? 'deleted' : (p.orgIsActive === false ? 'inactive' : p.status),
          totalOrders: new Set(),
          qtyOrdered: 0,
          qtyFulfilled: 0,
          qtyRefunded: 0,
          revenueGeneratedCents: 0,
          basePriceCents: scope?.role === "SUPER_ADMIN" ? (p.basePriceCents || 0) : 0,
          unitPriceCents: p.basePriceCents || 0,
          refundLossCents: 0
        }
      })

      results.forEach((row: any) => {
        if (productMap[row.globalProductId]) {
          const pInfo = productMap[row.globalProductId]
          pInfo.totalOrders.add(row.orderId)
          pInfo.qtyOrdered += row.qtyOrdered
          const s = (row.status || "").toUpperCase()
          if (['FULFILLED', 'REFUNDED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED'].includes(s)) {
            const refundedCount = refundQuantities[row.orderItemId] || 0
            const fulfilledCount = Math.max(0, row.qtyOrdered - refundedCount)
            pInfo.qtyRefunded += refundedCount
            pInfo.qtyFulfilled += fulfilledCount
            pInfo.revenueGeneratedCents += (fulfilledCount * row.priceCents)
            pInfo.refundLossCents += (refundedCount * row.priceCents)
          }
        }
      })

      const aggregated = Object.values(productMap).map(p => ({ ...p, totalOrders: p.totalOrders.size }))
      aggregated.sort((a, b) => b.revenueGeneratedCents === a.revenueGeneratedCents ? (a.productName || "").localeCompare(b.productName || "") : b.revenueGeneratedCents - a.revenueGeneratedCents)

      // 5. Comparison Logic
      let comparisonSummary = null
      if (compare && startDateParam && endDateParam) {
        let prevStart: Date, prevEnd: Date
        if (compareStartDateParam && compareEndDateParam) {
          prevStart = new Date(compareStartDateParam); prevEnd = new Date(compareEndDateParam)
          prevStart.setHours(0, 0, 0, 0); prevEnd.setHours(23, 59, 59, 999)
        } else {
          const start = new Date(startDateParam); const end = new Date(endDateParam)
          const duration = end.getTime() - start.getTime()
          prevStart = new Date(start.getTime() - duration - 1); prevEnd = new Date(start.getTime() - 1)
        }

        const compResults = await tx
          .select({ globalProductId: orderItems.globalProductId, status: orders.status, createdAt: orders.createdAt, qtyOrdered: orderItems.quantity, priceCents: orderItems.priceCents, orderItemId: orderItems.id })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(and(
            inArray(orders.branchId, branchIds),
            sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')`,
            parsedProductIds.length > 0 ? inArray(globalProducts.id, parsedProductIds) : undefined,
            (() => {
              const compCond: any[] = []
              if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) {
                if (parsedCompMonths.length > 0) compCond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
                if (parsedCompYears.length > 0) compCond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
              } else {
                compCond.push(gte(orders.createdAt, prevStart), lte(orders.createdAt, prevEnd))
              }
              return and(...compCond)
            })()
          ))

        const compOrderItemIds = compResults.map((r: any) => r.orderItemId)
        let compRefundMap: Record<number, number> = {}
        if (compOrderItemIds.length > 0) {
          const compRefunds = await tx.select({ orderItemId: refundItems.orderItemId, qty: refundItems.quantity }).from(refundItems).where(inArray(refundItems.orderItemId, compOrderItemIds))
          compRefundMap = compRefunds.reduce((acc: any, curr: any) => { if (curr.orderItemId) acc[curr.orderItemId] = (acc[curr.orderItemId] || 0) + curr.qty; return acc }, {})
        }

        const compProductMap: Record<number, any> = {}
        let compRev = 0, compVol = 0, compRef = 0
        compResults.forEach((r: any) => {
          const s = (r.status || "").toUpperCase()
          const refQ = compRefundMap[r.orderItemId] || 0
          compRef += refQ
          const fulfilledCount = Math.max(0, r.qtyOrdered - refQ)
          compVol += fulfilledCount
          compRev += (fulfilledCount * r.priceCents)
          if (!compProductMap[r.globalProductId]) compProductMap[r.globalProductId] = { qtyFulfilled: 0, revenueGeneratedCents: 0 }
          compProductMap[r.globalProductId].qtyFulfilled += fulfilledCount
          compProductMap[r.globalProductId].revenueGeneratedCents += (fulfilledCount * r.priceCents)
        })

        comparisonSummary = { totalRevenue: compRev, totalVolume: compVol, totalRefunds: compRef, uniqueSKUs: new Set(compResults.map((r: any) => r.globalProductId)).size }
        aggregated.forEach((p: any) => {
          const cmp = compProductMap[p.productId]
          p.compareQty = cmp ? cmp.qtyFulfilled : 0
          p.compareRevenue = cmp ? cmp.revenueGeneratedCents : 0
        })
      }

      // 6. Trend Aggregation
      const trend: Record<string, any> = {}
      results.forEach((row: any) => {
        const d = new Date(row.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!trend[key]) trend[key] = { date: key, revenue: 0, compareRevenue: 0, qtyOrdered: 0, qtyFulfilled: 0, qtyRefunded: 0 }
        trend[key].qtyOrdered += row.qtyOrdered
        const s = (row.status || "").toUpperCase()
        if (['FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED', 'REFUNDED'].includes(s)) {
          const refQ = refundQuantities[row.orderItemId] || 0
          const fulfilledCount = Math.max(0, row.qtyOrdered - refQ)
          trend[key].qtyRefunded += refQ
          trend[key].qtyFulfilled += fulfilledCount
          trend[key].revenue += (fulfilledCount * row.priceCents)
        }
      })

      return NextResponse.json({
        data: aggregated,
        trend: Object.values(trend).sort((a, b) => a.date.localeCompare(b.date)),
        comparison: comparisonSummary
      })
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch product performance" }, { status: 500 })
  }
}
