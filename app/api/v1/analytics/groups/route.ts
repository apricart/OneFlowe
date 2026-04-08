import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { groups, branches, orders, organizations, budgets, globalProducts, organizationInventory, categories } from "@/db/schema"
import { and, eq, sql, isNull, gte, lte, desc, inArray, asc } from "drizzle-orm"
import { metricExpressions, REVENUE_ELIGIBLE_FILTER } from "@/lib/metric-utils"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const orgIdParam = searchParams.get("organizationId")
    const groupIdsParam = searchParams.get("groupIds")
    const branchIdsParam = searchParams.get("branchIds")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const compare = searchParams.get("compare") === "true"
    const compareStartDateParam = searchParams.get("compareStartDate")
    const compareEndDateParam = searchParams.get("compareEndDate")

    const monthsRaw = searchParams.get("months")
    const yearsRaw = searchParams.get("years")
    const compareMonthsRaw = searchParams.get("compareMonths")
    const compareYearsRaw = searchParams.get("compareYears")

    const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter((n) => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter((n) => !isNaN(n) && n > 2000) : []
    const parsedCompMonths = compareMonthsRaw ? compareMonthsRaw.split(',').map(Number).filter((n) => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedCompYears = compareYearsRaw ? compareYearsRaw.split(',').map(Number).filter((n) => !isNaN(n) && n > 2000) : []

    const summaryOnly = searchParams.get("summaryOnly") === "true"
    const trendOnly = searchParams.get("trendOnly") === "true"
    const allTime = searchParams.get("allTime") === "true"
    const earliestOnly = searchParams.get("earliestOnly") === "true"

    return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      if (earliestOnly) {
        const firstOrder = await tx.select({ createdAt: orders.createdAt }).from(orders).orderBy(asc(orders.createdAt)).limit(1)
        return { earliestDate: firstOrder.length > 0 ? firstOrder[0].createdAt : new Date().toISOString() }
      }

      let orgId = scope?.organizationId
      if (orgIdParam && scope?.role === "SUPER_ADMIN") orgId = parseInt(orgIdParam)
      const parsedGroupIds = groupIdsParam ? groupIdsParam.split(',').map(Number).filter(id => !isNaN(id)) : []
      const parsedBranchIds = branchIdsParam ? branchIdsParam.split(',').map(Number).filter(id => !isNaN(id)) : []

      if (allTime) {
        const distinctYears = await tx.select({ year: sql<number>`EXTRACT(YEAR FROM ${orders.createdAt})::int` }).from(orders).innerJoin(branches, eq(orders.branchId, branches.id)).innerJoin(groups, eq(branches.groupId, groups.id)).where(and(REVENUE_ELIGIBLE_FILTER, orgId ? eq(groups.organizationId, orgId) : undefined)).groupBy(sql`EXTRACT(YEAR FROM ${orders.createdAt})`).orderBy(desc(sql`EXTRACT(YEAR FROM ${orders.createdAt})`))
        return { years: distinctYears.map((y: any) => y.year) }
      }

      const orderConditions: any[] = [REVENUE_ELIGIBLE_FILTER]
      if (parsedMonths.length > 0) orderConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
      if (parsedYears.length > 0) orderConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
      if (parsedMonths.length === 0 && parsedYears.length === 0) {
        if (startDate) { const start = new Date(startDate); start.setHours(0, 0, 0, 0); orderConditions.push(gte(orders.createdAt, start)) }
        if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); orderConditions.push(lte(orders.createdAt, end)) }
      }
      const orderWhere = and(...orderConditions)

      const periodList: string[] = []
      if (parsedMonths.length > 0 && parsedYears.length > 0) { parsedYears.forEach(y => parsedMonths.forEach(m => periodList.push(`${y}-${String(m).padStart(2, '0')}`))) }
      else if (startDate && endDate) { let curr = new Date(startDate); let end = new Date(endDate); while (curr <= end) { periodList.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`); curr.setMonth(curr.getMonth() + 1) } }
      else { periodList.push(new Date().toISOString().slice(0, 7)) }

      const groupConditions = []
      if (orgId) groupConditions.push(eq(groups.organizationId, orgId))
      if (parsedGroupIds.length > 0) groupConditions.push(sql`${groups.id} IN (${sql.join(parsedGroupIds, sql`, `)})`)

      if (trendOnly) {
        const trendData = await tx.select({ date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`, revenue: metricExpressions.revenue, orders: metricExpressions.totalOrderCount }).from(orders).innerJoin(branches, eq(orders.branchId, branches.id)).innerJoin(groups, eq(branches.groupId, groups.id)).where(and(orderWhere, orgId ? eq(groups.organizationId, orgId) : undefined, parsedGroupIds.length > 0 ? sql`${groups.id} IN (${sql.join(parsedGroupIds, sql`, `)})` : undefined, parsedBranchIds.length > 0 ? sql`${branches.id} IN (${sql.join(parsedBranchIds, sql`, `)})` : undefined)).groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`).orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
        let compareTrend: any[] = []
        if (compare) {
          let pS: Date, pE: Date; if (compareStartDateParam && compareEndDateParam) { pS = new Date(compareStartDateParam); pE = new Date(compareEndDateParam) } else if (startDate && endDate) { const start = new Date(startDate); const end = new Date(endDate); const dur = end.getTime() - start.getTime(); pS = new Date(start.getTime() - dur - 1); pE = new Date(start.getTime() - 1) } else { pS = new Date(); pE = new Date() }
          compareTrend = await tx.select({ date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`, revenue: metricExpressions.revenue }).from(orders).innerJoin(branches, eq(orders.branchId, branches.id)).innerJoin(groups, eq(branches.groupId, groups.id)).where(and(REVENUE_ELIGIBLE_FILTER, orgId ? eq(groups.organizationId, orgId) : undefined, parsedGroupIds.length > 0 ? inArray(groups.id, parsedGroupIds) : undefined, parsedBranchIds.length > 0 ? inArray(branches.id, parsedBranchIds) : undefined, (() => { const c: any[] = []; if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) { if (parsedCompMonths.length > 0) c.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`); if (parsedCompYears.length > 0) c.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`) } else { c.push(gte(orders.createdAt, pS), lte(orders.createdAt, pE)) }; return and(...c) })())).groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
        }
        return { trend: trendData, compareTrend }
      }

      const rawGroupStats = await tx.select({ id: groups.id, name: groups.name, status: groups.status, organizationId: groups.organizationId, organizationName: organizations.name, totalOrders: sql<number>`count(${orders.id})::int`, totalAmountCents: metricExpressions.revenue, totalRefundCents: sql<number>`coalesce(sum(${orders.refundAmountCents}), 0)::int`, rejectedOrders: sql<number>`count(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END)::int`, branchCount: sql<number>`count(distinct ${branches.id})::int`,
        branches: sql<any>`COALESCE(JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', ${branches.id}, 'name', ${branches.name})) FILTER (WHERE ${branches.id} IS NOT NULL), '[]')`
      }).from(groups).leftJoin(organizations, eq(groups.organizationId, organizations.id)).leftJoin(branches, eq(branches.groupId, groups.id)).leftJoin(orders, and(eq(orders.branchId, branches.id), orderWhere, parsedBranchIds.length > 0 ? inArray(orders.branchId, parsedBranchIds) : undefined)).where(and(...groupConditions)).groupBy(groups.id, organizations.id).orderBy(desc(metricExpressions.revenue))

      const gIds = rawGroupStats.map((g: any) => g.id)
      const bStatsMap: Record<number, any[]> = {}
      const gBudMap: Record<number, number> = {}

      if (gIds.length > 0) {
        const allBudgets = await tx.select({ branchId: branches.id, groupId: branches.groupId, baselineBudgetCents: branches.baselineBudgetCents, period: budgets.period, amountAllocatedCents: budgets.amountAllocatedCents, amountCreditedCents: budgets.amountCreditedCents }).from(branches).leftJoin(budgets, and(eq(budgets.branchId, branches.id), inArray(budgets.period, periodList))).where(inArray(branches.groupId, gIds))
        const matrix: Record<number, Record<string, { a: number, c: number }>> = {}, baseLines: Record<number, number> = {}, bInG: Record<number, Set<number>> = {}
        allBudgets.forEach((b: any) => { if (!b.groupId) return; if (!bInG[b.groupId]) bInG[b.groupId] = new Set(); bInG[b.groupId].add(b.branchId); baseLines[b.branchId] = b.baselineBudgetCents || 0; if (b.period) { if (!matrix[b.branchId]) matrix[b.branchId] = {}; matrix[b.branchId][b.period] = { a: b.amountAllocatedCents || 0, c: b.amountCreditedCents || 0 } } })
        gIds.forEach((gid: any) => { let total = 0; (bInG[gid] || []).forEach((bid: any) => { periodList.forEach(p => { const r = matrix[bid]?.[p]; total += r ? (r.a + r.c) : (baseLines[bid] || 0) }) }); gBudMap[gid] = total })

        const allBranchStats = await tx.select({ id: branches.id, name: branches.name, status: branches.status, groupId: branches.groupId, orders: sql<number>`count(${orders.id})::int`, revenue: metricExpressions.revenue, refunds: sql<number>`coalesce(sum(${orders.refundAmountCents}), 0)::int`, rejected: sql<number>`count(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END)::int` }).from(branches).leftJoin(orders, and(eq(orders.branchId, branches.id), orderWhere, parsedBranchIds.length > 0 ? inArray(orders.branchId, parsedBranchIds) : undefined)).where(inArray(branches.groupId, gIds)).groupBy(branches.id).orderBy(desc(metricExpressions.revenue))
        allBranchStats.forEach((bs: any) => { if (bs.groupId) { if (!bStatsMap[bs.groupId]) bStatsMap[bs.groupId] = []; let bBud = 0; periodList.forEach(p => { bBud += matrix[bs.id]?.[p] ? (matrix[bs.id][p].a + matrix[bs.id][p].c) : (baseLines[bs.id] || 0) }); bStatsMap[bs.groupId].push({ ...bs, totalBudget: bBud }) } })
      }

      const groupsWithBranches = rawGroupStats.map((g: any) => ({ ...g, totalBudget: gBudMap[g.id] || 0, branches: bStatsMap[g.id] || [] }))
      const outSummary = { totalGroups: groupsWithBranches.length, totalOrders: groupsWithBranches.reduce((s, g) => s + g.totalOrders, 0), totalRevenue: groupsWithBranches.reduce((s, g) => s + g.totalAmountCents, 0), totalRefunds: groupsWithBranches.reduce((s, g) => s + g.totalRefundCents, 0), avgRevenuePerGroup: groupsWithBranches.length > 0 ? Math.round(groupsWithBranches.reduce((s, g) => s + g.totalAmountCents, 0) / groupsWithBranches.length) : 0 }

      const ungrouped = await tx.select({ id: branches.id, name: branches.name, organizationId: branches.organizationId, organizationName: organizations.name, totalOrders: sql<number>`count(${orders.id})::int`, totalAmountCents: metricExpressions.revenue }).from(branches).leftJoin(organizations, eq(branches.organizationId, organizations.id)).leftJoin(orders, and(eq(orders.branchId, branches.id), orderWhere)).where(and(orgId ? eq(branches.organizationId, orgId) : undefined, isNull(branches.groupId), eq(branches.status, 'active'))).groupBy(branches.id, organizations.id).orderBy(desc(metricExpressions.revenue))
      outSummary.totalOrders += ungrouped.reduce((s: number, b: any) => s + b.totalOrders, 0); outSummary.totalRevenue += ungrouped.reduce((s: number, b: any) => s + b.totalAmountCents, 0)

      let compareSummary = null
      if (compare && (startDate || parsedCompMonths.length > 0)) {
        let pS: Date, pE: Date; if (compareStartDateParam && compareEndDateParam) { pS = new Date(compareStartDateParam); pE = new Date(compareEndDateParam) } else if (startDate && endDate) { const dur = new Date(endDate).getTime() - new Date(startDate).getTime(); pS = new Date(new Date(startDate).getTime() - dur - 1); pE = new Date(new Date(startDate).getTime() - 1) } else { pS = new Date(); pE = new Date() }
        const compStats = await tx.select({ totalOrders: metricExpressions.totalOrderCount, totalAmountCents: metricExpressions.revenue, totalRefunds: metricExpressions.totalRefundAmount }).from(orders).innerJoin(branches, eq(orders.branchId, branches.id)).leftJoin(groups, eq(branches.groupId, groups.id)).where(and(REVENUE_ELIGIBLE_FILTER, orgId ? eq(branches.organizationId, orgId) : undefined, parsedGroupIds.length > 0 ? inArray(groups.id, parsedGroupIds) : undefined, parsedBranchIds.length > 0 ? inArray(branches.id, parsedBranchIds) : undefined, (() => { const c: any[] = []; if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) { if (parsedCompMonths.length > 0) c.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`); if (parsedCompYears.length > 0) c.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`) } else { c.push(gte(orders.createdAt, pS), lte(orders.createdAt, pE)) }; return and(...c) })()))
        compareSummary = { totalOrders: compStats[0]?.totalOrders || 0, totalRevenue: compStats[0]?.totalAmountCents || 0, totalRefunds: compStats[0]?.totalRefunds || 0 }
      }

      if (summaryOnly) return { summary: outSummary, comparison: compareSummary }
      return { summary: outSummary, comparison: compareSummary, groups: groupsWithBranches, ungroupedBranches: ungrouped }
    }
  } catch (e: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

