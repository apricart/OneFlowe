import { NextResponse, type NextRequest } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, users, branches, organizations, groups, orderItems, refunds, refundItems } from "@/db/schema"
import { and, desc, eq, gte, lte, sql, sum, count, inArray } from "drizzle-orm"
import { metricExpressions } from "@/lib/metric-utils"
import { getRequestScope } from "@/lib/auth"
import { error, ok } from "@/lib/api"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")
    const branchIdParam = url.searchParams.get("branchId")
    const branchIdsRaw = url.searchParams.get("branchIds")
    const organizationIdParam = url.searchParams.get("organizationId")
    const groupIdParam = url.searchParams.get("groupId")
    const groupIdsRaw = url.searchParams.get("groupIds")
    const statusParam = url.searchParams.get("status")
    const compare = url.searchParams.get("compare") === "true"
    const compareStartDateParam = url.searchParams.get("compareStartDate")
    const compareEndDateParam = url.searchParams.get("compareEndDate")

    const parsedBranchIds = branchIdsRaw ? branchIdsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0) : []
    const parsedGroupIds = groupIdsRaw ? groupIdsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0) : (groupIdParam && groupIdParam !== "all" ? [Number(groupIdParam)] : [])

    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const monthsRaw = url.searchParams.get("months")
    const yearsRaw = url.searchParams.get("years")
    const compareMonthsRaw = url.searchParams.get("compareMonths")
    const compareYearsRaw = url.searchParams.get("compareYears")

    const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []
    const parsedCompMonths = compareMonthsRaw ? compareMonthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedCompYears = compareYearsRaw ? compareYearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const conditions: any[] = []
      if (statusParam && statusParam.toLowerCase() !== "all") {
        if (statusParam.toUpperCase() === "REJECTED") conditions.push(sql`UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED')`)
        else conditions.push(eq(sql`UPPER(${orders.status})`, statusParam.toUpperCase()))
      }

      if (scope!.role === "SUPER_ADMIN" && organizationIdParam && organizationIdParam !== "null" && organizationIdParam !== "0") {
        conditions.push(eq(orders.organizationId, Number(organizationIdParam)))
      }
      
      if (parsedBranchIds.length > 0) conditions.push(inArray(orders.branchId, parsedBranchIds))
      else if (branchIdParam && branchIdParam !== "all" && branchIdParam !== "null") conditions.push(eq(orders.branchId, Number(branchIdParam)))

      if (parsedGroupIds.length > 0) conditions.push(inArray(branches.groupId, parsedGroupIds))
      else if (groupIdParam && groupIdParam !== "all" && groupIdParam !== "null") conditions.push(eq(branches.groupId, Number(groupIdParam)))

      if (startDate && !monthsRaw && !yearsRaw) { const s = new Date(startDate); s.setHours(0, 0, 0, 0); conditions.push(gte(orders.createdAt, s)) }
      if (endDate && !monthsRaw && !yearsRaw) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); conditions.push(lte(orders.createdAt, e)) }

      if (parsedMonths.length > 0) conditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
      if (parsedYears.length > 0) conditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)

      const whereClause = and(...conditions)

      let comparisonSummary = null
      if (compare) {
        const compConditions = conditions.filter(c => { const s = String(c); return !s.includes("createdAt") && !s.includes("created_at") && !s.includes("EXTRACT(MONTH") && !s.includes("EXTRACT(YEAR"); })
        if (parsedCompMonths.length > 0) compConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
        if (parsedCompYears.length > 0) compConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
        if (parsedCompMonths.length === 0 && parsedCompYears.length === 0) {
          let pS: Date; let pE: Date
          if (compareStartDateParam && compareEndDateParam) { pS = new Date(compareStartDateParam); pE = new Date(compareEndDateParam); pS.setHours(0, 0, 0, 0); pE.setHours(23, 59, 59, 999) }
          else if (startDate && endDate) { const s = new Date(startDate); const e = new Date(endDate); const dur = e.getTime() - s.getTime(); pS = new Date(s.getTime() - dur - 1); pE = new Date(s.getTime() - 1) }
          else { pS = new Date(0); pE = new Date(0) }
          if (pS.getTime() !== 0) { compConditions.push(gte(orders.createdAt, pS), lte(orders.createdAt, pE)) }
        }
        const compWhere = and(...compConditions)
        const compResult = await tx.select({ totalSales: metricExpressions.revenue, orderCount: metricExpressions.orderVolume, refundedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END), 0)`.mapWith(Number), rejectedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END), 0)`.mapWith(Number), approvedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'APPROVED' THEN 1 END), 0)`.mapWith(Number) }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(compWhere)
        const compItems = await tx.select({ totalItemsSold: sum(orderItems.quantity) }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).leftJoin(branches, eq(orders.branchId, branches.id)).where(compWhere)
        comparisonSummary = { totalSales: compResult[0]?.totalSales || 0, totalOrders: compResult[0]?.orderCount || 0, refundedCount: compResult[0]?.refundedCount || 0, rejectedCount: compResult[0]?.rejectedCount || 0, approvedCount: compResult[0]?.approvedCount || 0, totalItemsSold: Number(compItems[0]?.totalItemsSold) || 0 }
      }

      const isFiltered = statusParam && statusParam.toLowerCase() !== "all"
      const summaryResult = await tx.select({ totalSales: isFiltered ? sql<number>`COALESCE(SUM(${orders.totalCents}), 0)`.mapWith(Number) : metricExpressions.revenue, totalTax: sum(orders.taxCents), totalSubtotal: sum(orders.subtotalCents), orderCount: isFiltered ? count(orders.id) : metricExpressions.orderVolume, totalOrderCount: count(orders.id), totalRefunds: sum(orders.refundAmountCents) }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(whereClause)
      const itemsRes = await tx.select({ totalItemsSold: sum(orderItems.quantity) }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).leftJoin(branches, eq(orders.branchId, branches.id)).where(whereClause)
      const summary = { ...summaryResult[0], totalItemsSold: itemsRes[0]?.totalItemsSold || 0 }

      const statusDistribution = await tx.select({ name: sql<string>`UPPER(${orders.status})`, value: count(orders.id) }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(whereClause).groupBy(sql`UPPER(${orders.status})`)
      const trendOnly = url.searchParams.get("trendOnly") === "true"
      let trendAgg: any[] = []
      if (trendOnly) {
        trendAgg = await tx.select({ month: sql<number>`EXTRACT(MONTH FROM ${orders.createdAt})`, year: sql<number>`EXTRACT(YEAR FROM ${orders.createdAt})`, revenue: metricExpressions.revenue, orders: metricExpressions.orderVolume }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(whereClause).groupBy(sql`EXTRACT(MONTH FROM ${orders.createdAt})`, sql`EXTRACT(YEAR FROM ${orders.createdAt})`).orderBy(sql`EXTRACT(YEAR FROM ${orders.createdAt})`, sql`EXTRACT(MONTH FROM ${orders.createdAt})`)
      }

      const summaryOnly = url.searchParams.get("summaryOnly") === "true"
      if (summaryOnly) return { summary: { ...summary, comparison: comparisonSummary, statusDistribution } }
      if (trendOnly) return { summary: { ...summary, comparison: comparisonSummary }, statusDistribution, trend: trendAgg }

      const recentOrders = await tx.select({
        id: orders.id, tid: orders.tid, status: orders.status, totalCents: orders.totalCents, subtotalCents: orders.subtotalCents, taxCents: orders.taxCents, refundAmountCents: orders.refundAmountCents,
        branchId: orders.branchId, branchName: branches.name, groupName: groups.name, organizationName: organizations.name,
        createdAt: orders.createdAt, fulfilledAt: orders.fulfilledAt, refundedAt: orders.refundedAt, userName: users.fullName, employeeId: users.employeeId,
        quantityOrdered: sql`(${tx.select({ s: sum(orderItems.quantity) }).from(orderItems).where(eq(orderItems.orderId, orders.id))})`,
        quantityRefunded: sql`(${tx.select({ s: sum(refundItems.quantity) }).from(refundItems).innerJoin(refunds, eq(refundItems.refundId, refunds.id)).where(and(eq(refunds.orderId, orders.id), sql`UPPER(${refunds.status}) IN ('APPROVED', 'COMPLETED')`))})`
      }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).leftJoin(organizations, eq(orders.organizationId, organizations.id)).leftJoin(groups, eq(branches.groupId, groups.id)).leftJoin(users, eq(orders.createdByUserId, users.id)).where(whereClause).orderBy(desc(orders.createdAt)).limit(limit).offset(offset)

      const topPerformers = await tx.select({ branchId: orders.branchId, branchName: branches.name, sales: metricExpressions.revenue, orderCount: metricExpressions.orderVolume, fulfilledCount: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)`.mapWith(Number), rejectedCount: sql<number>`count(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END)`.mapWith(Number), refundedCount: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END)`.mapWith(Number) }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(whereClause).groupBy(orders.branchId, branches.name).orderBy(desc(metricExpressions.revenue)).limit(10)

      return { summary: { ...summary, comparison: comparisonSummary }, orders: recentOrders, topPerformers, pagination: { page, limit, hasMore: recentOrders.length === limit } }
    }

    return ok(result)
  } catch (e: any) {
    return error(e.message || "Internal error")
  }
}
