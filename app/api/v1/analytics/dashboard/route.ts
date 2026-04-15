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
        
        const fromDate = new Date()
        fromDate.setDate(fromDate.getDate() - 6)
        fromDate.setHours(0, 0, 0, 0)

        const orderConditions: any[] = [gte(orders.createdAt, fromDate), REVENUE_ELIGIBLE_FILTER]
        
        // Role-based filtering enforcement - CRITICAL: Restricted roles MUST be filtered
        const RESTRICTED_ROLES = ["BRANCH_ADMIN", "ORDER_PORTAL"]
        const isRestricted = RESTRICTED_ROLES.includes(scope.role)
        
        if (scope.role === "SUPER_ADMIN") {
          // SUPER_ADMIN can optionally filter by org/branch
          if (orgIdParam && orgIdParam !== "null" && orgIdParam !== "0") organizationId = Number(orgIdParam)
          if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") branchId = Number(branchIdParam)
          if (organizationId) orderConditions.push(eq(orders.organizationId, organizationId))
          if (branchId) orderConditions.push(eq(orders.branchId, branchId))
        } else if (scope.role === "HEAD_OFFICE") {
          // HEAD_OFFICE can filter by branch within their org
          if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") branchId = Number(branchIdParam)
          orderConditions.push(eq(orders.organizationId, organizationId!))
          if (branchId) orderConditions.push(eq(orders.branchId, branchId))
        } else if (scope.role === "BRANCH_ADMIN") {
          // BRANCH_ADMIN is FORCED to their own branch - CANNOT see other branches
          branchId = scope.branchId!
          orderConditions.push(eq(orders.branchId, branchId))
          if (organizationId) orderConditions.push(eq(orders.organizationId, organizationId))
        } else if (scope.role === "ORDER_PORTAL") {
          // ORDER_PORTAL is FORCED to their own branch AND own orders only
          branchId = scope.branchId!
          orderConditions.push(eq(orders.branchId, branchId))
          orderConditions.push(eq(orders.createdByUserId, scope.userId!))
          if (organizationId) orderConditions.push(eq(orders.organizationId, organizationId))
        }
        if (groupIdParam && groupIdParam !== "null" && groupIdParam !== "0") orderConditions.push(eq(branches.groupId, Number(groupIdParam)))

        const whereClause = and(...orderConditions)
        const dayExpr = sql`date_trunc('day', ${orders.createdAt})`
        const gmvRows = await tx
          .select({ day: dayExpr, totalCents: metricExpressions.revenue })
          .from(orders).leftJoin(branches, eq(orders.branchId, branches.id))
          .where(whereClause).groupBy(dayExpr).orderBy(dayExpr)

        // SECURITY: Build branch filters - NEVER allow empty filters for restricted roles
        const branchFilters: any[] = []
        if (organizationId && scope.role === "SUPER_ADMIN") branchFilters.push(eq(branches.organizationId, organizationId))
        
        // CRITICAL: For restricted roles, ALWAYS enforce branch filter
        if (isRestricted && branchId) {
          branchFilters.push(eq(branches.id, branchId))
        } else if (branchId) {
          branchFilters.push(eq(branches.id, branchId))
        }
        
        if (groupIdParam && groupIdParam !== "null" && groupIdParam !== "0") branchFilters.push(eq(branches.groupId, Number(groupIdParam)))

        // SECURITY: If no filters and restricted role, force their branch only
        const finalBranchWhere = branchFilters.length > 0 
          ? and(...branchFilters)
          : isRestricted && branchId 
            ? eq(branches.id, branchId) 
            : undefined

        const branchRows = await tx.select({
          id: branches.id,
          name: branches.name,
          orderCount: sql<number>`coalesce(count(${orders.id}), 0)`.mapWith(Number),
        }).from(branches)
          .leftJoin(orders, and(eq(orders.branchId, branches.id), ...orderConditions))
          .where(finalBranchWhere)
          .groupBy(branches.id).orderBy(sql`coalesce(count(${orders.id}), 0) desc`).limit(scope.role === "BRANCH_ADMIN" || scope.role === "ORDER_PORTAL" ? 1 : 5)

        const branchCountRows = await tx.select({ count: sql<number>`coalesce(count(${branches.id}), 0)` }).from(branches)
          .where(finalBranchWhere)
        const branchCount = Number(branchCountRows[0]?.count || 0)

        let pendingApprovals = 0
        if (scope.role !== "SUPER_ADMIN") {
          const pendingConditions: any[] = [eq(sql`UPPER(${orders.status})`, "PENDING")]
          if (organizationId) pendingConditions.push(eq(orders.organizationId, organizationId))
          // CRITICAL: Restricted roles MUST have branch filter
          if (isRestricted && branchId) {
            pendingConditions.push(eq(orders.branchId, branchId))
          } else if (branchId) {
            pendingConditions.push(eq(orders.branchId, branchId))
          }
          const pendingRow = await tx.select({ count: sql<number>`coalesce(count(${orders.id}), 0)` }).from(orders)
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(and(...pendingConditions))
          pendingApprovals = Number(pendingRow[0]?.count || 0)
        }

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        startOfMonth.setHours(0, 0, 0, 0)
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        const monthConditions: any[] = [
          gte(orders.createdAt, startOfMonth), 
          lt(orders.createdAt, startOfNextMonth), 
          REVENUE_ELIGIBLE_FILTER
        ]
        if (organizationId && scope.role === "SUPER_ADMIN") monthConditions.push(eq(orders.organizationId, organizationId))
        // CRITICAL: Restricted roles MUST have branch filter
        if (isRestricted && branchId) {
          monthConditions.push(eq(orders.branchId, branchId))
        } else if (branchId) {
          monthConditions.push(eq(orders.branchId, branchId))
        }

        const ordersMonthRow = await tx.select({ count: sql<number>`coalesce(count(${orders.id}), 0)` }).from(orders)
          .leftJoin(branches, eq(orders.branchId, branches.id))
          .where(and(...monthConditions))
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
          branchCount, pendingApprovals, ordersThisMonth,
          userRole: scope.role
        }
      })
    }

    const data = await getCached(cacheKey, fetchDashboardData, 180)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 })
  }
}

