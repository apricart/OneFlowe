import { NextResponse, type NextRequest } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, branches, organizations, groups } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc, sql } from "drizzle-orm"
import { metricExpressions, REVENUE_ELIGIBLE_FILTER } from "@/lib/metric-utils"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const startDateParam = url.searchParams.get("startDate")
    const endDateParam = url.searchParams.get("endDate")
    const organizationIdParam = url.searchParams.get("organizationId")
    const groupIdsParam = url.searchParams.get("groupIds")
    const branchIdsParam = url.searchParams.get("branchIds")
    
    const summaryOnly = url.searchParams.get("summaryOnly") === "true"
    const trendOnly = url.searchParams.get("trendOnly") === "true"
    const allTime = url.searchParams.get("allTime") === "true"
    
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

    const parsedGroupIds = groupIdsParam ? groupIdsParam.split(',').map(Number).filter(id => !isNaN(id)) : []
    const parsedBranchIds = branchIdsParam ? branchIdsParam.split(',').map(Number).filter(id => !isNaN(id)) : []

    return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      let finalOrgId = scope?.role === "SUPER_ADMIN" ? null : scope?.organizationId
      if (scope?.role === "SUPER_ADMIN" && organizationIdParam) {
        finalOrgId = parseInt(organizationIdParam)
      }

      const conditions: any[] = [REVENUE_ELIGIBLE_FILTER]
      if (finalOrgId) conditions.push(eq(branches.organizationId, finalOrgId))
      if (parsedGroupIds.length > 0) conditions.push(inArray(branches.groupId, parsedGroupIds))
      if (parsedBranchIds.length > 0) conditions.push(inArray(branches.id, parsedBranchIds))

      // All Time
      if (allTime) {
        const distinctYears = await tx
          .select({ year: sql<number>`EXTRACT(YEAR FROM ${orders.createdAt})::int` })
          .from(orders)
          .innerJoin(branches, eq(orders.branchId, branches.id))
          .where(and(...conditions))
          .groupBy(sql`EXTRACT(YEAR FROM ${orders.createdAt})`)
          .orderBy(desc(sql`EXTRACT(YEAR FROM ${orders.createdAt})`))

        return NextResponse.json({ years: distinctYears.map((y: any) => y.year) })
      }

      // Date Filters
      const dateConditions = [...conditions]
      if (parsedMonths.length > 0) {
        dateConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
      }
      if (parsedYears.length > 0) {
        dateConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
      }

      if (parsedMonths.length === 0 && parsedYears.length === 0) {
        if (startDateParam) dateConditions.push(gte(orders.createdAt, new Date(startDateParam)))
        if (endDateParam) {
          const end = new Date(endDateParam)
          end.setHours(23, 59, 59, 999)
          dateConditions.push(lte(orders.createdAt, end))
        }
      }

      // Trend Only
      if (trendOnly) {
        const trendData = await tx
          .select({
            date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
            revenue: metricExpressions.revenue,
            orders: metricExpressions.totalOrderCount,
          })
          .from(orders)
          .innerJoin(branches, eq(orders.branchId, branches.id))
          .where(and(...dateConditions))
          .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)

        let compareTrend: any[] = []
        if (compare) {
          let prevStart: Date, prevEnd: Date
          if (compareStartDateParam && compareEndDateParam) {
            prevStart = new Date(compareStartDateParam); prevEnd = new Date(compareEndDateParam)
          } else if (startDateParam && endDateParam) {
            const start = new Date(startDateParam); const end = new Date(endDateParam)
            const duration = end.getTime() - start.getTime()
            prevStart = new Date(start.getTime() - duration - 1); prevEnd = new Date(start.getTime() - 1)
          } else {
            prevStart = new Date(); prevEnd = new Date()
          }

          compareTrend = await tx
            .select({
              date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
              revenue: metricExpressions.revenue,
            })
            .from(orders)
            .innerJoin(branches, eq(orders.branchId, branches.id))
            .where(and(
              REVENUE_ELIGIBLE_FILTER,
              finalOrgId ? eq(branches.organizationId, finalOrgId) : undefined,
              parsedGroupIds.length > 0 ? inArray(branches.groupId, parsedGroupIds) : undefined,
              parsedBranchIds.length > 0 ? inArray(branches.id, parsedBranchIds) : undefined,
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
            .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
        }

        return NextResponse.json({ trend: trendData, compareTrend })
      }

      // Summary Only
      if (summaryOnly) {
        const [stats] = await tx
          .select({
            totalOrders: metricExpressions.totalOrderCount,
            totalRevenue: metricExpressions.revenue,
            totalRefunds: metricExpressions.totalRefundAmount,
            activeBranches: sql<number>`count(distinct ${branches.id})`.mapWith(Number),
          })
          .from(orders)
          .innerJoin(branches, eq(orders.branchId, branches.id))
          .where(and(...dateConditions))

        let comparisonSummary = null
        if (compare) {
          let prevStart: Date, prevEnd: Date
          if (compareStartDateParam && compareEndDateParam) {
            prevStart = new Date(compareStartDateParam); prevEnd = new Date(compareEndDateParam)
          } else if (startDateParam && endDateParam) {
            const start = new Date(startDateParam); const end = new Date(endDateParam)
            const duration = end.getTime() - start.getTime()
            prevStart = new Date(start.getTime() - duration - 1); prevEnd = new Date(start.getTime() - 1)
          } else {
            prevStart = new Date(); prevEnd = new Date()
          }

          const [compStats] = await tx
            .select({
              totalOrders: metricExpressions.totalOrderCount,
              totalRevenue: metricExpressions.revenue,
              totalRefunds: metricExpressions.totalRefundAmount,
            })
            .from(orders)
            .innerJoin(branches, eq(orders.branchId, branches.id))
            .where(and(
              REVENUE_ELIGIBLE_FILTER,
              finalOrgId ? eq(branches.organizationId, finalOrgId) : undefined,
              parsedGroupIds.length > 0 ? inArray(branches.groupId, parsedGroupIds) : undefined,
              parsedBranchIds.length > 0 ? inArray(branches.id, parsedBranchIds) : undefined,
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
          
          comparisonSummary = compStats
        }

        return NextResponse.json({ summary: stats, comparison: comparisonSummary })
      }

      // Full Report
      const branchResults = await tx
        .select({
          id: branches.id,
          name: branches.name,
          status: branches.status,
          organizationName: organizations.name,
          groupName: groups.name,
          totalOrders: sql<number>`count(${orders.id})`.mapWith(Number),
          fulfilledOrders: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)`.mapWith(Number),
          revenue: metricExpressions.revenue,
          refunds: sql<number>`coalesce(sum(${orders.refundAmountCents}), 0)`.mapWith(Number),
        })
        .from(branches)
        .leftJoin(organizations, eq(branches.organizationId, organizations.id))
        .leftJoin(groups, eq(branches.groupId, groups.id))
        .leftJoin(orders, and(eq(orders.branchId, branches.id), ...dateConditions))
        .where(and(
          finalOrgId ? eq(branches.organizationId, finalOrgId) : undefined, 
          parsedGroupIds.length > 0 ? inArray(branches.groupId, parsedGroupIds) : undefined,
          parsedBranchIds.length > 0 ? inArray(branches.id, parsedBranchIds) : undefined
        ))
        .groupBy(branches.id, organizations.name, groups.name)
        .orderBy(desc(metricExpressions.revenue))

      return NextResponse.json({ items: branchResults })
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

