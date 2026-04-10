import { type NextRequest, NextResponse } from "next/server"
import { and, eq, gte, lte, sql, or, inArray, desc, gt } from "drizzle-orm"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, branches, organizations } from "@/db/schema"
import { getCached, generateCacheKey, CACHE_TTL } from "@/lib/cache-utils"
import { getRequestScope } from "@/lib/auth"
import { error } from "@/lib/api"

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

    const monthsRaw = searchParams.get("months")
    const yearsRaw = searchParams.get("years")
    const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []

    // Default to 2026 data range
    const defaultStart = new Date("2026-01-01T00:00:00.000Z")
    const defaultEnd = new Date("2026-12-31T23:59:59.999Z")
    const startDate = startDateParam ? new Date(startDateParam) : defaultStart
    const endDate = endDateParam ? new Date(endDateParam) : defaultEnd

    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const forcedGranularity = searchParams.get("granularity") as any
    const granularity = ["hourly", "daily", "monthly", "yearly"].includes(forcedGranularity) 
      ? forcedGranularity 
      : (diffDays <= 1 ? "hourly" : diffDays <= 32 ? "daily" : diffDays <= 400 ? "monthly" : "yearly")

    const cacheKey = generateCacheKey("sales-perf", {
      role: scope.role, orgId: scope.organizationId, branchId: scope.branchId,
      start: startDate.toISOString(), end: endDate.toISOString(), granularity, status: statusParam
    })

    const fetchData = async () => {
      return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

      async function handler(tx: any) {
        const orgIds: number[] = organizationIdsParam ? organizationIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : []
        const branchIds: number[] = branchIdsParam ? branchIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : []
        const groupIds: number[] = groupIdsParam ? groupIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : (groupIdParam ? [Number(groupIdParam)] : [])

        // Build WHERE conditions
        const conditions: any[] = []
        
        // Date filter
        if (!monthsRaw && !yearsRaw) {
          conditions.push(gte(orders.createdAt, startDate))
          conditions.push(lte(orders.createdAt, endDate))
        }
        if (parsedMonths.length > 0) {
          conditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
        }
        if (parsedYears.length > 0) {
          conditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
        }

        // Status filter
        const upperStatus = statusParam?.toUpperCase()
        if (upperStatus && upperStatus !== "ALL") {
          if (upperStatus === "REJECTED") {
            conditions.push(or(eq(sql`UPPER(${orders.status})`, "REJECTED"), eq(sql`UPPER(${orders.status})`, "CANCELLED")))
          } else if (upperStatus === "PARTIAL") {
            conditions.push(or(
              and(eq(sql`UPPER(${orders.status})`, "FULFILLED"), gt(sql`COALESCE(${orders.refundAmountCents}, 0)`, 0)),
              inArray(sql`UPPER(${orders.status})`, ["PARTIAL", "PARTIALLY_FULFILLED"])
            ))
          } else if (upperStatus === "FULFILLED") {
            conditions.push(and(eq(sql`UPPER(${orders.status})`, "FULFILLED"), eq(sql`COALESCE(${orders.refundAmountCents}, 0)`, 0)))
          } else {
            conditions.push(eq(sql`UPPER(${orders.status})`, upperStatus))
          }
        }

        // Organization filter
        if (orgIds.length > 0) {
          conditions.push(inArray(orders.organizationId, orgIds))
        } else if (orgIdParam && scope!.role === "SUPER_ADMIN") {
          conditions.push(eq(orders.organizationId, Number(orgIdParam)))
        }

        // Branch filter
        if (branchIds.length > 0) {
          conditions.push(inArray(orders.branchId, branchIds))
        } else if (branchIdParam && scope!.role !== "BRANCH_ADMIN") {
          conditions.push(eq(orders.branchId, Number(branchIdParam)))
        }

        // Group filter
        if (groupIds.length > 0) {
          conditions.push(inArray(branches.groupId, groupIds))
        }

        // Time expressions
        const tz = 'Asia/Karachi'
        let bucketExpr: any
        let labelExpr: any
        
        if (granularity === "hourly") {
          bucketExpr = sql`date_trunc('hour', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')`
          labelExpr = sql`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'HH12:MI AM')`
        } else if (granularity === "daily") {
          bucketExpr = sql`date_trunc('day', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')`
          labelExpr = sql`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'DD Mon')`
        } else if (granularity === "monthly") {
          bucketExpr = sql`date_trunc('month', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')`
          labelExpr = sql`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'Mon YYYY')`
        } else {
          bucketExpr = sql`date_trunc('year', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')`
          labelExpr = sql`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'YYYY')`
        }

        // Revenue expression
        const revenueExpr = sql`COALESCE(SUM(
          CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED') 
          THEN ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) 
          ELSE 0 END
        ), 0)`

        // Main query
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined
        
        const baseQuery = tx.select({
          bucket: bucketExpr,
          label: labelExpr,
          revenue: revenueExpr,
          orderCount: sql`COALESCE(COUNT(1), 0)`.mapWith(Number)
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        
        const seriesResult = whereClause 
          ? await baseQuery.where(whereClause).groupBy(bucketExpr, labelExpr).orderBy(sql`MIN(${orders.createdAt})`)
          : await baseQuery.groupBy(bucketExpr, labelExpr).orderBy(sql`MIN(${orders.createdAt})`)

        const seriesData = seriesResult.map((r: any) => ({
          label: r.label,
          sales: Number(r.revenue || 0) / 100,
          netSales: Number(r.revenue || 0) / 100,
          orders: Number(r.orderCount || 0)
        }))

        const totalSales = seriesData.reduce((s: number, r: any) => s + r.sales, 0)
        const totalOrders = seriesData.reduce((s: number, r: any) => s + r.orders, 0)

        // Branch sales
        const branchRevenueExpr = sql`COALESCE(SUM(
          CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED') 
          THEN ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) 
          ELSE 0 END
        ), 0)`
        
        const branchConditions = [
          sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED', 'PENDING', 'REJECTED', 'CANCELLED')`,
          ...(conditions.length > 0 ? [whereClause] : [])
        ].filter(Boolean)
        
        const branchResult = await tx.select({
          branchId: branches.id,
          branchName: branches.name,
          revenue: branchRevenueExpr,
          orderCount: sql`COALESCE(COUNT(${orders.id}), 0)`.mapWith(Number)
        })
        .from(branches)
        .leftJoin(orders, and(eq(orders.branchId, branches.id), branchConditions.length > 1 ? and(...branchConditions.slice(1)) : branchConditions[0]))
        .groupBy(branches.id, branches.name)
        .orderBy(desc(branchRevenueExpr))
        .limit(20)

        const branchSales = branchResult.map((r: any) => ({
          branchId: r.branchId,
          branchName: r.branchName,
          sales: Number(r.revenue || 0) / 100,
          orders: Number(r.orderCount || 0)
        }))

        // Organization sales
        let organizationSales: any[] = []
        if (scope?.role === "SUPER_ADMIN" && !orgIdParam) {
          const orgRevenueExpr = sql`COALESCE(SUM(
            CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED') 
            THEN ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) 
            ELSE 0 END
          ), 0)`
          
          const orgBaseQuery = tx.select({
            organizationId: organizations.id,
            organizationName: organizations.name,
            revenue: orgRevenueExpr,
            orderCount: sql`COALESCE(COUNT(${orders.id}), 0)`.mapWith(Number)
          })
          .from(organizations)
          .leftJoin(orders, eq(orders.organizationId, organizations.id))
          
          const orgResult = whereClause
            ? await orgBaseQuery.where(whereClause).groupBy(organizations.id, organizations.name).orderBy(desc(orgRevenueExpr)).limit(20)
            : await orgBaseQuery.groupBy(organizations.id, organizations.name).orderBy(desc(orgRevenueExpr)).limit(20)

          organizationSales = orgResult.map((r: any) => ({
            organizationId: r.organizationId,
            organizationName: r.organizationName,
            sales: Number(r.revenue || 0) / 100,
            orders: Number(r.orderCount || 0)
          }))
        }

        return {
          granularity,
          seriesData,
          totalSales,
          totalNetSales: totalSales,
          totalOrders,
          avgSales: seriesData.length > 0 ? totalSales / seriesData.length : 0,
          peakPeriod: seriesData.length > 0 ? seriesData.reduce((max: any, r: any) => r.sales > max.sales ? r : max, seriesData[0]) : null,
          branchSales,
          organizationSales,
          comparison: null
        }
      }
    }

    const data = await getCached(cacheKey, fetchData, CACHE_TTL.ANALYTICS)
    return NextResponse.json(data)
  } catch (e: any) {
    console.error("[SalesPerformance API] Error:", e)
    console.error("[SalesPerformance API] Stack:", e?.stack)
    return error(e?.message || "Failed to fetch sales performance analytics", 500)
  }
}
