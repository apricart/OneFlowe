import { NextResponse, type NextRequest } from "next/server"
import { budgets, orders, orderItems, branches, globalProducts, categories } from "@/db/schema"
import { and, eq, gte, lte, inArray, sql, desc, asc, isNotNull } from "drizzle-orm"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const startDateParam = url.searchParams.get("startDate")
    const endDateParam = url.searchParams.get("endDate")
    const branchIdsParam = url.searchParams.get("branchIds")
    const branchIdParam = url.searchParams.get("branchId")
    const organizationIdParam = url.searchParams.get("organizationId")
    const granularity = url.searchParams.get("granularity") || "monthly"

    return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      let allowedOrgId = scope?.organizationId
      if (scope?.role === "SUPER_ADMIN" && organizationIdParam) allowedOrgId = Number(organizationIdParam)

      let branchIds: number[] = []
      if (branchIdsParam) branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id))
      else if (branchIdParam && branchIdParam !== "all") branchIds = [Number(branchIdParam)]
      else if (["BRANCH_ADMIN", "BRANCH_MANAGER", "ORDER_PORTAL"].includes(scope?.role || "")) branchIds = [scope?.branchId as number]
      else if (allowedOrgId) {
        const b = await tx.select({ id: branches.id }).from(branches).where(eq(branches.organizationId, allowedOrgId))
        branchIds = b.map((br: any) => br.id)
      } else if (scope?.role === "SUPER_ADMIN") {
        const b = await tx.select({ id: branches.id }).from(branches)
        branchIds = b.map((br: any) => br.id)
      }

      if (branchIds.length === 0) return NextResponse.json({ error: "No branches selected" }, { status: 400 })

      let startDate: Date
      if (startDateParam) startDate = new Date(startDateParam)
      else {
        const firstBudget = await tx.select({ period: budgets.period }).from(budgets).where(allowedOrgId ? eq(budgets.organizationId, allowedOrgId) : isNotNull(budgets.organizationId)).orderBy(asc(budgets.period)).limit(1)
        startDate = firstBudget.length > 0 ? new Date(firstBudget[0].period + "-01") : new Date(); if (firstBudget.length === 0) startDate.setDate(1)
      }
      const endDate = endDateParam ? new Date(endDateParam) : new Date()
      startDate.setHours(0, 0, 0, 0); endDate.setHours(23, 59, 59, 999)

      const periods = new Set<string>()
      for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
        let mS = (y === startDate.getFullYear()) ? startDate.getMonth() : 0
        let mE = (y === endDate.getFullYear()) ? endDate.getMonth() : 11
        for (let m = mS; m <= mE; m++) periods.add(`${y}-${String(m + 1).padStart(2, '0')}`)
      }
      const periodList = Array.from(periods)

      const activeBranches = await tx.select({ id: branches.id, name: branches.name, baselineBudgetCents: branches.baselineBudgetCents, organizationId: branches.organizationId }).from(branches).where(inArray(branches.id, branchIds))
      if (activeBranches.length === 0) return NextResponse.json({ summary: { totalAllocated: 0, totalSpent: 0, totalHeld: 0, totalCredited: 0, totalRemaining: 0 }, chartData: [], branchBreakdown: [], insights: { spentGrowth: 0, allocationGrowth: 0 }, categories: [] })

      const actualBranchIds = activeBranches.map((b: any) => b.id)
      const budgetRecords = await tx.select().from(budgets).where(and(inArray(budgets.branchId, actualBranchIds), inArray(budgets.period, periodList)))

      const budgetLookup: any = {}
      budgetRecords.forEach((r: any) => { if (!budgetLookup[r.branchId]) budgetLookup[r.branchId] = {}; budgetLookup[r.branchId][r.period] = r })

      let totalAllocated = 0, totalSpent = 0, totalHeld = 0, totalCredited = 0
      activeBranches.forEach((branch: any) => {
        periodList.forEach(period => {
          const record = budgetLookup[branch.id]?.[period]
          totalSpent += record ? (record.amountSpentCents || 0) : 0
          totalHeld += record ? (record.amountHeldCents || 0) : 0
          totalAllocated += record ? (record.amountAllocatedCents || 0) : (branch.baselineBudgetCents || 0)
          totalCredited += record ? (record.amountCreditedCents || 0) : 0
        })
      })

      const categorySpendingRows = budgetRecords.length > 0 ? await tx.select({ categoryId: globalProducts.categoryId, categoryName: categories.name, spentCents: sql<number>`SUM((${orderItems.priceCents} * ${orderItems.quantity}) - COALESCE((SELECT SUM(amount_cents) FROM refund_items WHERE order_item_id = ${orderItems.id}), 0))`.mapWith(Number) }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).innerJoin(globalProducts, eq(orderItems.globalProductId, globalProducts.id)).leftJoin(categories, eq(globalProducts.categoryId, categories.id)).where(and(inArray(orders.branchId, actualBranchIds), gte(orders.createdAt, startDate), lte(orders.createdAt, endDate), inArray(orders.status, ['PENDING', 'APPROVED', 'FULFILLED']))).groupBy(globalProducts.categoryId, categories.name).orderBy(desc(sql`SUM(${orderItems.priceCents} * ${orderItems.quantity})`)) : []

      const dur = endDate.getTime() - startDate.getTime(), pE = new Date(startDate.getTime() - 1), pS = new Date(pE.getTime() - dur)
      const prevPeriods = new Set<string>()
      for (let y = pS.getFullYear(); y <= pE.getFullYear(); y++) {
        let mS = (y === pS.getFullYear()) ? pS.getMonth() : 0
        let mE = (y === pE.getFullYear()) ? pE.getMonth() : 11
        for (let m = mS; m <= mE; m++) prevPeriods.add(`${y}-${String(m + 1).padStart(2, '0')}`)
      }
      const prevBudgetRecords = await tx.select().from(budgets).where(and(inArray(budgets.branchId, actualBranchIds), inArray(budgets.period, Array.from(prevPeriods))))
      let prevAlloc = 0, prevExp = 0
      prevBudgetRecords.forEach((b: any) => { prevAlloc += b.amountAllocatedCents || 0; prevExp += (b.amountSpentCents || 0) + (b.amountHeldCents || 0) })

      const chartDataMap: any = {}
      periods.forEach(p => chartDataMap[p] = { period: p, branches: {} })
      activeBranches.forEach((branch: any) => {
        periodList.forEach(period => {
          const r = budgetLookup[branch.id]?.[period], base = branch.baselineBudgetCents || 0, alloc = r ? (r.amountAllocatedCents || 0) : base, cred = r ? (r.amountCreditedCents || 0) : 0
          const bLine = Math.min(alloc, base), addon = (alloc - bLine) + cred
          if (!chartDataMap[period].branches[branch.id]) chartDataMap[period].branches[branch.id] = { branchName: branch.name, baseline: 0, addon: 0, spent: 0 }
          chartDataMap[period].branches[branch.id].baseline += bLine
          chartDataMap[period].branches[branch.id].addon += addon
          chartDataMap[period].branches[branch.id].spent += (r ? (r.amountSpentCents || 0) + (r.amountHeldCents || 0) : 0)
        })
      })

      let finalChartData = Object.values(chartDataMap).sort((a: any, b: any) => a.period.localeCompare(b.period))
      if (granularity === "yearly") {
        const yearly: any = {}
        finalChartData.forEach((d: any) => {
          const y = d.period.slice(0, 4); if (!yearly[y]) yearly[y] = { date: y, branches: {} }
          Object.entries(d.branches).forEach(([bid, b]: [string, any]) => {
            if (!yearly[y].branches[bid]) yearly[y].branches[bid] = { ...b }
            else { yearly[y].branches[bid].baseline += b.baseline; yearly[y].branches[bid].addon += b.addon; yearly[y].branches[bid].spent += b.spent }
          })
        })
        finalChartData = Object.values(yearly).map((d: any) => ({ date: d.date, branches: Object.entries(d.branches).map(([id, data]: [string, any]) => ({ branchId: id, ...data })) }))
      } else finalChartData = finalChartData.map((d: any) => ({ date: d.period, branches: Object.entries(d.branches).map(([id, data]: [string, any]) => ({ branchId: id, ...data })) }))

      const branchBreakdown = activeBranches.map((branch: any) => {
        let bAlloc = 0, bSpent = 0, bHeld = 0, bCred = 0
        periodList.forEach(period => {
          const r = budgetLookup[branch.id]?.[period]
          bSpent += r ? (r.amountSpentCents || 0) : 0; bHeld += r ? (r.amountHeldCents || 0) : 0
          bAlloc += r ? (r.amountAllocatedCents || 0) : (branch.baselineBudgetCents || 0); bCred += r ? (r.amountCreditedCents || 0) : 0
        })
        return { branchId: branch.id, branchName: branch.name, allocated: bAlloc, spent: bSpent + bHeld, held: bHeld, credited: bCred, remaining: (bAlloc + bCred) - (bSpent + bHeld), baselineAmount: branch.baselineBudgetCents || 0 }
      })

      return NextResponse.json({
        summary: { totalAllocated, totalSpent: totalSpent + totalHeld, totalHeld, totalCredited, totalRemaining: (totalAllocated + totalCredited) - (totalSpent + totalHeld) },
        insights: { spentGrowth: prevExp > 0 ? ((totalSpent + totalHeld - prevExp) / prevExp) * 100 : 0, allocationGrowth: prevAlloc > 0 ? ((totalAllocated - prevAlloc) / prevAlloc) * 100 : 0 },
        categories: categorySpendingRows, chartData: finalChartData, branchBreakdown
      })
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

