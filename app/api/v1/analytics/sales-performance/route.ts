import { type NextRequest, NextResponse } from "next/server"
import { and, eq, gte, lte, sql, or, inArray, desc, gt } from "drizzle-orm"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, branches, organizations } from "@/db/schema"
import { getCached, generateCacheKey, CACHE_TTL } from "@/lib/cache-utils"
import { metricExpressions } from "@/lib/metric-utils"
import { getRequestScope } from "@/lib/auth"
import { error, ok } from "@/lib/api"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const orgIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")
    const branchIdsParam = searchParams.get("branchIds")
    const organizationIdsParam = searchParams.get("organizationIds")
    const groupIdParam = searchParams.get("groupId")
    const groupIdsParam = searchParams.get("groupIds")
    const statusParam = searchParams.get("status")
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const compareStartDateParam = searchParams.get("compareStartDate")
    const compareEndDateParam = searchParams.get("compareEndDate")

    const monthsRaw = searchParams.get("months")
    const yearsRaw = searchParams.get("years")
    const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []

    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
    const startDate = startDateParam ? new Date(startDateParam) : todayStart
    const endDate = endDateParam ? new Date(endDateParam) : todayEnd

    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const forcedGranularity = searchParams.get("granularity") as any
    const granularity = ["hourly", "daily", "monthly", "yearly"].includes(forcedGranularity) ? forcedGranularity : (parsedMonths.length > 0 ? (parsedMonths.length > 1 ? "monthly" : "daily") : (parsedYears.length > 0 ? (parsedYears.length > 1 ? "yearly" : "monthly") : (diffDays <= 1 ? "hourly" : diffDays <= 32 ? "daily" : diffDays <= 400 ? "monthly" : "yearly")))

    const cacheKey = generateCacheKey("sales-perf", {
      role: scope.role, organizationId: scope.organizationId, branchId: scope.branchId,
      branchIds: branchIdsParam, organizationIds: organizationIdsParam, groupIds: groupIdsParam,
      status: statusParam, start: startDate.toISOString().slice(0, 16), end: endDate.toISOString().slice(0, 16),
      compareStart: compareStartDateParam, compareEnd: compareEndDateParam, granularity
    })

    const fetchData = async () => {
      return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

      async function handler(tx: any) {
        const organizationIds: number[] = organizationIdsParam ? organizationIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : []
        const branchIds: number[] = branchIdsParam ? branchIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : []
        const groupIds: number[] = groupIdsParam ? groupIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : (groupIdParam ? [Number(groupIdParam)] : [])

        const conditions: any[] = []
        if (!monthsRaw && !yearsRaw) { conditions.push(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)) }
        if (parsedMonths.length > 0) conditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
        if (parsedYears.length > 0) conditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)

        const upperStatus = statusParam?.toUpperCase()
        if (upperStatus && upperStatus !== "ALL") {
          if (upperStatus === "REJECTED") conditions.push(or(eq(sql`UPPER(${orders.status})`, "REJECTED"), eq(sql`UPPER(${orders.status})`, "CANCELLED")))
          else if (upperStatus === "PARTIAL") conditions.push(or(and(eq(sql`UPPER(${orders.status})`, "FULFILLED"), gt(sql`COALESCE(${orders.refundAmountCents}, 0)`, 0)), inArray(sql`UPPER(${orders.status})`, ["PARTIAL", "PARTIALLY_FULFILLED"])))
          else if (upperStatus === "FULFILLED") conditions.push(and(eq(sql`UPPER(${orders.status})`, "FULFILLED"), eq(sql`COALESCE(${orders.refundAmountCents}, 0)`, 0)))
          else conditions.push(eq(sql`UPPER(${orders.status})`, upperStatus))
        }

        if (organizationIds.length > 0) conditions.push(inArray(orders.organizationId, organizationIds))
        else if (orgIdParam && scope!.role === "SUPER_ADMIN") conditions.push(eq(orders.organizationId, Number(orgIdParam)))

        if (branchIds.length > 0) conditions.push(inArray(orders.branchId, branchIds))
        else if (branchIdParam && scope!.role !== "BRANCH_ADMIN") conditions.push(eq(orders.branchId, Number(branchIdParam)))

        if (groupIds.length > 0) conditions.push(inArray(branches.groupId, groupIds))

        const tz = 'Asia/Karachi'
        let dExpr: any; let lExpr: any
        if (granularity === "hourly") { dExpr = sql`date_trunc('hour', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`; lExpr = sql<string>`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'HH12:MI AM')` }
        else if (granularity === "daily") { dExpr = sql`date_trunc('day', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`; lExpr = sql<string>`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'DD Mon')` }
        else if (granularity === "monthly") { dExpr = sql`date_trunc('month', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`; lExpr = sql<string>`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'Mon YYYY')` }
        else { dExpr = sql`date_trunc('year', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`; lExpr = sql<string>`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY')` }

        const seriesRows = await tx.select({ bucket: dExpr, label: lExpr, totalSales: metricExpressions.revenue, orderCount: sql<number>`COALESCE(COUNT(1), 0)`.mapWith(Number) }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(and(...conditions)).groupBy(dExpr, lExpr).orderBy(dExpr)
        const seriesData = seriesRows.map((r: any) => ({ label: r.label, sales: (r.totalSales || 0) / 100, netSales: (r.totalSales || 0) / 100, orders: Number(r.orderCount || 0) }))
        const totalSales = seriesData.reduce((s: number, r: any) => s + r.sales, 0)
        const totalOrders = seriesData.reduce((s: number, r: any) => s + r.orders, 0)
        const branchSelectRows = await tx.select({ branchId: branches.id, branchName: branches.name, totalSales: metricExpressions.revenue, orderCount: sql<number>`COALESCE(COUNT(${orders.id}), 0)`.mapWith(Number) }).from(branches).leftJoin(orders, and(eq(orders.branchId, branches.id), and(...conditions, sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED', 'PENDING', 'REJECTED', 'CANCELLED')`))).groupBy(branches.id, branches.name).orderBy(desc(metricExpressions.revenue)).limit(20)

        let organizationSales: any[] = []
        if (scope && scope.role === "SUPER_ADMIN" && !orgIdParam) {
          const orgRows = await tx.select({ organizationId: organizations.id, organizationName: organizations.name, totalSales: metricExpressions.revenue, orderCount: sql<number>`COALESCE(COUNT(${orders.id}), 0)`.mapWith(Number) }).from(organizations).leftJoin(orders, and(eq(orders.organizationId, organizations.id), and(...conditions))).groupBy(organizations.id, organizations.name).orderBy(desc(metricExpressions.revenue)).limit(20)
          organizationSales = orgRows.map((r: any) => ({ organizationId: r.organizationId, organizationName: r.organizationName, sales: (r.totalSales || 0) / 100, orders: Number(r.orderCount) }))
        }

        let comparison: any = null
        if (searchParams.get("compare") === "true") {
          const compConditions: any[] = []
          if (startDateParam && endDateParam && !monthsRaw && !yearsRaw) {
            let pS: Date; let pE: Date
            if (compareStartDateParam && compareEndDateParam) { pS = new Date(compareStartDateParam); pE = new Date(compareEndDateParam); pS.setHours(0,0,0,0); pE.setHours(23,59,59,999) }
            else { const dur = endDate.getTime() - startDate.getTime(); pS = new Date(startDate.getTime() - dur - 1); pE = new Date(startDate.getTime() - 1) }
            compConditions.push(gte(orders.createdAt, pS), lte(orders.createdAt, pE))
          }
          if (organizationIds.length > 0) compConditions.push(inArray(orders.organizationId, organizationIds))
          else if (orgIdParam && scope!.role === "SUPER_ADMIN") compConditions.push(eq(orders.organizationId, Number(orgIdParam)))
          if (branchIds.length > 0) compConditions.push(inArray(orders.branchId, branchIds))
          else if (branchIdParam && scope!.role !== "BRANCH_ADMIN") compConditions.push(eq(orders.branchId, Number(branchIdParam)))
          if (groupIds.length > 0) compConditions.push(inArray(branches.groupId, groupIds))

          const compSeriesRows = await tx.select({ label: lExpr, totalSales: metricExpressions.revenue, orderCount: sql<number>`COALESCE(COUNT(1), 0)`.mapWith(Number) }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(and(...compConditions)).groupBy(dExpr, lExpr).orderBy(dExpr)
          const compStatusRows = await tx.select({ fulfilledNetSales: metricExpressions.revenue, fulfilledCount: metricExpressions.fulfilledCount, refundedCount: metricExpressions.refundedCount, rejectedCount: metricExpressions.rejectedCount, approvedCount: metricExpressions.approvedCount, pendingCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'PENDING' THEN 1 END), 0)`.mapWith(Number) }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(and(...compConditions))
          comparison = { totalSales: compSeriesRows.reduce((a: number, b: any) => a + (Number(b.totalSales) || 0) / 100, 0), totalOrders: compSeriesRows.reduce((a: number, b: any) => a + Number(b.orderCount || 0), 0), fulfilledNetSales: (compStatusRows[0]?.fulfilledNetSales || 0) / 100, fulfilledCount: compStatusRows[0]?.fulfilledCount || 0, refundedCount: compStatusRows[0]?.refundedCount || 0, rejectedCount: compStatusRows[0]?.rejectedCount || 0, approvedCount: compStatusRows[0]?.approvedCount || 0, pendingCount: compStatusRows[0]?.pendingCount || 0 }
        }

        return { granularity, seriesData, totalSales, totalNetSales: totalSales, totalOrders, avgSales: seriesData.length > 0 ? totalSales / seriesData.length : 0, peakPeriod: seriesData.length > 0 ? seriesData.reduce((max: any, r: any) => r.sales > max.sales ? r : max, seriesData[0]) : null, branchSales: branchSelectRows.map((r: any) => ({ branchId: r.branchId, branchName: r.branchName, sales: (r.totalSales || 0) / 100, orders: Number(r.orderCount) })), organizationSales, comparison }
      }
    }

    const data = await getCached(cacheKey, fetchData, CACHE_TTL.ANALYTICS)
    return NextResponse.json(data)
  } catch (e: any) {
    return error("Failed to fetch sales performance analytics")
  }
}
