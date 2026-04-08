import { type NextRequest, NextResponse } from "next/server"
import { and, eq, gte, sql, or, lt } from "drizzle-orm"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { getCached, generateCacheKey } from "@/lib/cache-utils"
import { REVENUE_ELIGIBLE_FILTER, metricExpressions } from "@/lib/metric-utils"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const orgIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")
    const groupIdParam = searchParams.get("groupId")

    const cacheKey = generateCacheKey('dashboard-analytics', {
      role: scope.role,
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      orgIdParam, branchIdParam, groupIdParam
    })

    const fetchDashboardData = async () => {
      const runner = scope.role === "SUPER_ADMIN" ? withSuperAdmin : withTenant
      return await runner(scope as any, async (tx) => {
        let organizationId = scope.organizationId
        let branchId = scope.branchId
        if (scope.role === "SUPER_ADMIN") {
          if (orgIdParam && orgIdParam !== "null" && orgIdParam !== "0") organizationId = Number(orgIdParam)
          if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") branchId = Number(branchIdParam)
        } else if (scope.role === "HEAD_OFFICE") {
          if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") branchId = Number(branchIdParam)
        }

        const fromDate = new Date()
        fromDate.setDate(fromDate.getDate() - 6)
        fromDate.setHours(0, 0, 0, 0)

        const orderConditions: any[] = [gte(orders.createdAt, fromDate), REVENUE_ELIGIBLE_FILTER]
        if (organizationId && scope.role === "SUPER_ADMIN") orderConditions.push(eq(orders.organizationId, organizationId))
        if (branchId && (scope.role === "SUPER_ADMIN" || scope.role === "HEAD_OFFICE")) orderConditions.push(eq(orders.branchId, branchId))
        if (groupIdParam && groupIdParam !== "null" && groupIdParam !== "0") orderConditions.push(eq(branches.groupId, Number(groupIdParam)))

        const whereClause = and(...orderConditions)
        const dayExpr = sql`date_trunc('day', ${orders.createdAt})`
        const gmvRows = await tx
          .select({ day: dayExpr, totalCents: metricExpressions.revenue })
          .from(orders).leftJoin(branches, eq(orders.branchId, branches.id))
          .where(whereClause).groupBy(dayExpr).orderBy(dayExpr)

        const branchFilters: any[] = []
        if (organizationId && scope.role === "SUPER_ADMIN") branchFilters.push(eq(branches.organizationId, organizationId))
        if (branchId) branchFilters.push(eq(branches.id, branchId))
        if (groupIdParam && groupIdParam !== "null" && groupIdParam !== "0") branchFilters.push(eq(branches.groupId, Number(groupIdParam)))

        const branchRows = await tx.select({
          id: branches.id,
          name: branches.name,
          orderCount: sql<number>`coalesce(count(${orders.id}), 0)`.mapWith(Number),
        }).from(branches)
          .leftJoin(orders, and(eq(orders.branchId, branches.id), ...orderConditions))
          .where(branchFilters.length ? and(...branchFilters) : undefined)
          .groupBy(branches.id).orderBy(sql`coalesce(count(${orders.id}), 0) desc`).limit(scope.role === "BRANCH_ADMIN" ? 1 : 5)

        const branchCountRows = await tx.select({ count: sql<number>`coalesce(count(${branches.id}), 0)` }).from(branches)
          .where(branchFilters.length ? and(...branchFilters) : undefined)
        const branchCount = Number(branchCountRows[0]?.count || 0)

        let pendingApprovals = 0
        if (scope.role !== "SUPER_ADMIN") {
          const pendingRow = await tx.select({ count: sql<number>`coalesce(count(${orders.id}), 0)` }).from(orders)
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(and(or(eq(sql`UPPER(${orders.status})`, "PENDING")), organizationId ? eq(orders.organizationId, organizationId) : undefined, branchId ? eq(orders.branchId, branchId) : undefined))
          pendingApprovals = Number(pendingRow[0]?.count || 0)
        }

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        startOfMonth.setHours(0, 0, 0, 0)
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        const ordersMonthRow = await tx.select({ count: sql<number>`coalesce(count(${orders.id}), 0)` }).from(orders)
          .leftJoin(branches, eq(orders.branchId, branches.id))
          .where(and(gte(orders.createdAt, startOfMonth), lt(orders.createdAt, startOfNextMonth), REVENUE_ELIGIBLE_FILTER, organizationId && scope.role === "SUPER_ADMIN" ? eq(orders.organizationId, organizationId) : undefined, branchId ? eq(orders.branchId, branchId) : undefined))
        const ordersThisMonth = Number(ordersMonthRow[0]?.count || 0)

        const today = new Date(); today.setHours(0, 0, 0, 0)
        const days = Array.from({ length: 7 }).map((_, index) => {
          const d = new Date(today); d.setDate(today.getDate() - (6 - index))
          return { label: d.toLocaleDateString("en-US", { weekday: "short" }), key: d.toISOString().slice(0, 10) }
        })

        const gmvMap: Record<string, number> = {}
        gmvRows.forEach((row: any) => {
          const key = new Date(row.day as any).toISOString().slice(0, 10)
          gmvMap[key] = (row.totalCents || 0) / 100
        })

        return {
          gmvSeries: days.map(day => ({ label: day.label, value: Number(gmvMap[day.key]?.toFixed(2) || 0) })),
          branchSeries: branchRows.map((row: any) => ({ label: row.name || "Unnamed", value: Number(row.orderCount || 0) })),
          branchCount, pendingApprovals, ordersThisMonth
        }
      })
    }

    const data = await getCached(cacheKey, fetchDashboardData, 180)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 })
  }
}

