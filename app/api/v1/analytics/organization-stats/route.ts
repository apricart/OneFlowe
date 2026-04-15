export const dynamic = 'force-dynamic'
import { NextResponse, type NextRequest } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, users, branches, organizations } from "@/db/schema"
import { and, eq, gte, lte, sql, count, inArray } from "drizzle-orm"
import { metricExpressions } from "@/lib/metric-utils"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")
    const compare = url.searchParams.get("compare") === "true"
    const compStart = url.searchParams.get("compareStartDate")
    const compEnd = url.searchParams.get("compareEndDate")

    const orgIdsParam = url.searchParams.get("organizationIds")
    const orgIdParam = url.searchParams.get("organizationId")
    const branchIdsParam = url.searchParams.get("branchIds")
    const statusParam = url.searchParams.get("status")

    const months = url.searchParams.get("months")?.split(',').map(Number).filter(n => !isNaN(n)) || []
    const years = url.searchParams.get("years")?.split(',').map(Number).filter(n => !isNaN(n)) || []
    const compMonths = url.searchParams.get("compareMonths")?.split(',').map(Number).filter(n => !isNaN(n)) || []
    const compYears = url.searchParams.get("compareYears")?.split(',').map(Number).filter(n => !isNaN(n)) || []

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const branchConditions: any[] = []
      if (scope!.role !== "SUPER_ADMIN") branchConditions.push(eq(branches.organizationId, scope!.organizationId!))

      if (orgIdsParam) {
        const ids = orgIdsParam.split(",").map(Number).filter(n => !isNaN(n))
        if (ids.length > 0) branchConditions.push(inArray(branches.organizationId, ids))
      } else if (orgIdParam && orgIdParam !== "all" && orgIdParam !== "0") {
        branchConditions.push(eq(branches.organizationId, Number(orgIdParam)))
      }

      if (branchIdsParam) {
        const ids = branchIdsParam.split(",").map(Number).filter(n => !isNaN(n))
        if (ids.length > 0) branchConditions.push(inArray(branches.id, ids))
      }
      if (statusParam && statusParam !== "all") branchConditions.push(eq(branches.status, statusParam))

      const branchWhere = branchConditions.length > 0 ? and(...branchConditions) : undefined

      const branchStats = await tx.select({
        branchId: branches.id,
        branchName: branches.name,
        organizationId: branches.organizationId,
        organizationName: organizations.name,
        organizationStatus: organizations.status,
        branchStatus: branches.status,
        activeUserCount: sql<number>`(SELECT COUNT(*) FROM ${users} WHERE ${users.branchId} = ${branches.id} AND ${users.isActive} = true)`.mapWith(Number),
        totalUserCount: sql<number>`(SELECT COUNT(*) FROM ${users} WHERE ${users.branchId} = ${branches.id})`.mapWith(Number),
      }).from(branches).leftJoin(organizations, eq(branches.organizationId, organizations.id)).where(branchWhere)

      const branchIdsInScope = branchStats.map((b: any) => b.branchId)
      if (branchIdsInScope.length === 0) return { items: [], trend: [], comparisonTrend: [] }

      const getMetrics = async (s: string | null, e: string | null, ms: number[], ys: number[]) => {
        const cond = [inArray(orders.branchId, branchIdsInScope)]
        if (ms.length > 0) cond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(ms, sql`, `)})`)
        if (ys.length > 0) cond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(ys, sql`, `)})`)
        if (ms.length === 0 && ys.length === 0 && s && e) {
          cond.push(gte(orders.createdAt, new Date(s)), lte(orders.createdAt, new Date(e)))
        }
        return tx.select({
          branchId: orders.branchId,
          revenueCents: metricExpressions.revenue,
          orderCount: count(orders.id),
          fulfilledCount: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)`.mapWith(Number),
          refundedCount: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END)`.mapWith(Number),
          refundedRevenueCents: sql<number>`SUM(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN ${orders.totalCents} ELSE 0 END)`.mapWith(Number),
        }).from(orders).where(and(...cond)).groupBy(orders.branchId)
      }

      const getTrend = async (s: string | null, e: string | null, ms: number[], ys: number[]) => {
        const cond = [inArray(orders.branchId, branchIdsInScope)]
        const granularity = url.searchParams.get("granularity")
        let grouping = sql`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'YYYY-MM')`
        if (granularity === "yearly") grouping = sql`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'YYYY')`
        else if (granularity === "daily") grouping = sql`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD')`

        if (ms.length > 0) cond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(ms, sql`, `)})`)
        if (ys.length > 0) cond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(ys, sql`, `)})`)
        if (ms.length === 0 && ys.length === 0 && s && e) {
          cond.push(gte(orders.createdAt, new Date(s)), lte(orders.createdAt, new Date(e)))
        }

        return tx.select({
          period: grouping,
          revenue: sql<number>`${metricExpressions.revenue} / 100`.mapWith(Number),
          orders: metricExpressions.totalOrderCount,
        }).from(orders).where(and(...cond)).groupBy(grouping).orderBy(grouping)
      }

      const [metricsA, metricsB, trendA, trendB] = await Promise.all([
        getMetrics(startDate, endDate, months, years),
        compare ? getMetrics(compStart, compEnd, compMonths, compYears) : Promise.resolve([]),
        getTrend(startDate, endDate, months, years),
        compare ? getTrend(compStart, compEnd, compMonths, compYears) : Promise.resolve([])
      ])

      const orgMap: any = {}
      branchStats.forEach((b: any) => {
        const oid = b.organizationId || 0
        if (!orgMap[oid]) orgMap[oid] = { organizationId: oid, organizationName: b.organizationName || "Unknown", organizationStatus: b.organizationStatus || "active", branchCount: 0, activeBranchCount: 0, totalUserCount: 0, activeUserCount: 0, revenue: 0, orderCount: 0, fulfilledCount: 0, refundedCount: 0, refundedRevenue: 0, comparison: compare ? { revenue: 0, orderCount: 0, fulfilledCount: 0, refundedCount: 0 } : null }
        const org = orgMap[oid]
        org.branchCount++
        if (b.branchStatus === 'active') org.activeBranchCount++
        org.totalUserCount += b.totalUserCount
        org.activeUserCount += b.activeUserCount

        const mA = metricsA.find((m: any) => m.branchId === b.branchId)
        if (mA) {
          org.revenue += (mA.revenueCents || 0) / 100
          org.orderCount += mA.orderCount
          org.fulfilledCount += mA.fulfilledCount
          org.refundedCount += mA.refundedCount
          org.refundedRevenue += (mA.refundedRevenueCents || 0) / 100
        }
        if (compare) {
          const mB = metricsB.find((m: any) => m.branchId === b.branchId)
          if (mB) {
            org.comparison.revenue += (mB.revenueCents || 0) / 100
            org.comparison.orderCount += mB.orderCount
            org.comparison.fulfilledCount += mB.fulfilledCount
            org.comparison.refundedCount += mB.refundedCount
          }
        }
      })

      return { items: Object.values(orgMap), trend: trendA, comparisonTrend: trendB }
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

