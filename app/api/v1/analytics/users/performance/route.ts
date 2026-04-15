import { NextResponse, type NextRequest } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, users, branches, roles, organizations } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc, sql } from "drizzle-orm"
import { metricExpressions } from "@/lib/metric-utils"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const startDateParam = url.searchParams.get("startDate")
    const endDateParam = url.searchParams.get("endDate")
    const organizationIdsParam = url.searchParams.get("organizationIds")
    const branchIdsParam = url.searchParams.get("branchIds")
    const compare = url.searchParams.get("compare") === "true"
    const summaryOnly = url.searchParams.get("summaryOnly") === "true"
    const trendOnly = url.searchParams.get("trendOnly") === "true"
    const allTime = url.searchParams.get("allTime") === "true"
    const compareStartDateParam = url.searchParams.get("compareStartDate")
    const compareEndDateParam = url.searchParams.get("compareEndDate")

    const monthsRaw = url.searchParams.get("months")
    const yearsRaw = url.searchParams.get("years")
    const userIdsRaw = url.searchParams.get("userIds")
    const groupIdsRaw = url.searchParams.get("groupIds")
    const compareMonthsRaw = url.searchParams.get("compareMonths")
    const compareYearsRaw = url.searchParams.get("compareYears")

    const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []
    const userIds = userIdsRaw ? userIdsRaw.split(',').filter(id => id.length > 5) : [] 
    const groupIds = groupIdsRaw ? groupIdsRaw.split(',').map(Number).filter(n => !isNaN(n)) : []
    const parsedCompMonths = compareMonthsRaw ? compareMonthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedCompYears = compareYearsRaw ? compareYearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []

    return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      // 1. Resolve Organization & Branch context
      let organizationIds: number[] = []
      if (organizationIdsParam) {
        organizationIds = organizationIdsParam.split(",").map(Number).filter(id => !isNaN(id) && id > 0)
      } else if (scope?.organizationId) {
        organizationIds = [scope.organizationId]
      }

      let branchIds: number[] = []
      if (branchIdsParam) {
        branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
      } else if (groupIds.length > 0) {
        const b = await tx.select({ id: branches.id }).from(branches).where(inArray(branches.groupId, groupIds))
        branchIds = b.map((br: any) => br.id)
      } else if (scope?.role === "BRANCH_ADMIN") {
        branchIds = [scope.branchId as number]
      } else if (organizationIds.length > 0) {
        const b = await tx.select({ id: branches.id }).from(branches).where(inArray(branches.organizationId, organizationIds))
        branchIds = b.map((br: any) => br.id)
      } else {
        const b = await tx.select({ id: branches.id }).from(branches)
        branchIds = b.map((br: any) => br.id)
      }

      if (branchIds.length === 0) return NextResponse.json({ error: "No branches resolved" }, { status: 400 })

      let startDate = startDateParam ? new Date(startDateParam) : undefined
      let endDate = endDateParam ? new Date(endDateParam) : undefined
      if (startDate) startDate.setHours(0, 0, 0, 0)
      if (endDate) endDate.setHours(23, 59, 59, 999)

      const baseConditions: any[] = [inArray(orders.branchId, branchIds)]
      if (userIds.length > 0) baseConditions.push(inArray(orders.createdByUserId, userIds))
      if (parsedMonths.length > 0) baseConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
      if (parsedYears.length > 0) baseConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
      if (parsedMonths.length === 0 && parsedYears.length === 0) {
        if (startDate) baseConditions.push(gte(orders.createdAt, startDate))
        if (endDate) baseConditions.push(lte(orders.createdAt, endDate))
      }

      const results = await tx
        .select({
          userId: users.id,
          userName: users.fullName,
          userEmail: sql<string>`REGEXP_REPLACE(${users.email}, '^deleted_[0-9]+_', '')`,
          employeeId: sql<string>`COALESCE(${users.employeeId}, SPLIT_PART(${users.id}::text, '-', 1))`,
          branchName: branches.name,
          organizationName: organizations.name,
          tids: sql<string>`STRING_AGG(${orders.tid}, ',')`,
          status: sql<string>`CASE WHEN ${users.deletedAt} IS NOT NULL THEN 'DELETED' WHEN ${users.isActive} = TRUE THEN 'ACTIVE' ELSE 'INACTIVE' END`,
          totalOrders: sql<number>`count(${orders.id})`,
          fulfilledOrders: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)`,
          refundedOrders: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END)`,
          totalSpentCents: metricExpressions.revenue,
        })
        .from(users)
        .innerJoin(orders, eq(orders.createdByUserId, users.id))
        .innerJoin(roles, eq(users.roleId, roles.id))
        .leftJoin(branches, eq(users.branchId, branches.id))
        .leftJoin(organizations, eq(orders.organizationId, organizations.id))
        .where(and(...baseConditions, eq(roles.name, "ORDER_PORTAL")))
        .groupBy(users.id, branches.name, organizations.name, users.deletedAt, users.isActive)
        .orderBy(desc(metricExpressions.revenue))

      let comparisonSummary = null
      if (compare && startDateParam && endDateParam) {
        let prevEnd: Date | undefined
        if (compareStartDateParam && compareEndDateParam) {
          prevEnd = new Date(compareEndDateParam); prevEnd.setHours(23, 59, 59, 999)
        } else {
          const start = new Date(startDateParam); const end = new Date(endDateParam)
          const duration = end.getTime() - start.getTime()
          prevEnd = new Date(start.getTime() - 1)
        }

        const compCond: any[] = []
        if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) {
          if (parsedCompMonths.length > 0) compCond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
          if (parsedCompYears.length > 0) compCond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
        } else if (prevEnd) {
          compCond.push(lte(orders.createdAt, prevEnd))
        }
        if (userIds.length > 0) compCond.push(inArray(orders.createdByUserId, userIds))

        const [compStats] = await tx
          .select({
            compOrders: metricExpressions.totalOrderCount,
            compFulfilled: metricExpressions.fulfilledCount,
            compSpent: metricExpressions.revenue,
            compUsers: sql<number>`count(distinct ${orders.createdByUserId})`.mapWith(Number)
          })
          .from(orders)
          .innerJoin(users, eq(orders.createdByUserId, users.id))
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(and(inArray(orders.branchId, branchIds), eq(roles.name, "ORDER_PORTAL"), ...compCond))

        comparisonSummary = {
          totalOrders: Number(compStats?.compOrders || 0),
          totalFulfilled: Number(compStats?.compFulfilled || 0),
          totalSpentCents: Number(compStats?.compSpent || 0),
          totalUsers: Number(compStats?.compUsers || 0)
        }
      }

      if (allTime) {
        const distinctYears = await tx
          .select({ year: sql<number>`EXTRACT(YEAR FROM ${orders.createdAt})::int` })
          .from(orders)
          .innerJoin(users, eq(orders.createdByUserId, users.id))
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(and(inArray(orders.branchId, branchIds), eq(roles.name, "ORDER_PORTAL")))
          .groupBy(sql`EXTRACT(YEAR FROM ${orders.createdAt})`)
          .orderBy(desc(sql`EXTRACT(YEAR FROM ${orders.createdAt})`))

        return NextResponse.json({ years: distinctYears.map((y: any) => y.year) })
      }

      if (summaryOnly) {
        return NextResponse.json({
          data: {
            totalOrders: results.reduce((sum: number, u: any) => sum + Number(u.totalOrders || 0), 0),
            fulfilledOrders: results.reduce((sum: number, u: any) => sum + Number(u.fulfilledOrders || 0), 0),
            totalSpentCents: results.reduce((sum: number, u: any) => sum + Number(u.totalSpentCents || 0), 0),
            totalUsers: results.length
          },
          comparison: comparisonSummary
        })
      }

      if (trendOnly) {
        const trendData = await tx
          .select({
            date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
            revenue: metricExpressions.revenue,
            qtyOrdered: metricExpressions.totalOrderCount,
            qtyFulfilled: metricExpressions.fulfilledCount,
            qtyRefunded: metricExpressions.refundedCount,
          })
          .from(orders)
          .innerJoin(users, eq(orders.createdByUserId, users.id))
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(and(...baseConditions, eq(roles.name, "ORDER_PORTAL")))
          .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)

        let compareTrend: any[] = []
        if (compare && (parsedCompMonths.length > 0 || parsedCompYears.length > 0 || (compareStartDateParam && compareEndDateParam))) {
          const compCond: any[] = []
          if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) {
            if (parsedCompMonths.length > 0) compCond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
            if (parsedCompYears.length > 0) compCond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
          } else if (compareStartDateParam && compareEndDateParam) {
            const cEnd = new Date(compareEndDateParam); cEnd.setHours(23, 59, 59, 999)
            compCond.push(lte(orders.createdAt, cEnd))
          }
          if (userIds.length > 0) compCond.push(inArray(orders.createdByUserId, userIds))

          compareTrend = await tx
            .select({
              date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
              revenue: metricExpressions.revenue,
              qtyOrdered: metricExpressions.totalOrderCount,
            })
            .from(orders)
            .innerJoin(users, eq(orders.createdByUserId, users.id))
            .innerJoin(roles, eq(users.roleId, roles.id))
            .where(and(inArray(orders.branchId, branchIds), eq(roles.name, "ORDER_PORTAL"), ...compCond))
            .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
        }

        return NextResponse.json({
          data: results,
          trend: trendData,
          compareTrend,
          comparison: comparisonSummary
        })
      }

      return NextResponse.json({ data: results, comparison: comparisonSummary })
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch user performance" }, { status: 500 })
  }
}

