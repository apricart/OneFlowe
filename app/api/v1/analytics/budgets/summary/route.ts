import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets, orders, orderItems, branches, globalProducts, categories } from "@/db/schema"
import { and, eq, gte, lte, inArray, sql, desc } from "drizzle-orm"
import { Role } from "@/lib/rbac"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const userId = (session.user as any).id
        const userRole = ((session.user as any).role || "").toUpperCase().replace(/\s+/g, '_')
        const userOrgId = (session.user as any).organizationId
        const userBranchId = (session.user as any).branchId

        const url = new URL(req.url)
        const startDateParam = url.searchParams.get("startDate")
        const endDateParam = url.searchParams.get("endDate")
        const branchIdsParam = url.searchParams.get("branchIds")
        const branchIdParam = url.searchParams.get("branchId")
        const organizationIdParam = url.searchParams.get("organizationId")
        const granularity = url.searchParams.get("granularity") || "monthly" // daily, monthly, yearly

        // 1. RBAC Check and Branch/Org Resolution
        let allowedOrgId = userOrgId
        if (userRole === "SUPER_ADMIN" && organizationIdParam) {
            allowedOrgId = Number(organizationIdParam)
        }

        let branchIds: number[] = []
        if (branchIdsParam) {
            branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        } else if (branchIdParam && branchIdParam !== "all") {
            branchIds = [Number(branchIdParam)]
        } else if (userRole === "BRANCH_ADMIN" || userRole === "BRANCH_MANAGER" || userRole === "ORDER_PORTAL") {
            branchIds = [userBranchId]
        } else if (allowedOrgId) {
            // Fetch all branches for this org
            const b = await db.select({ id: branches.id }).from(branches).where(eq(branches.organizationId, allowedOrgId))
            branchIds = b.map(br => br.id)
        } else if (userRole === "SUPER_ADMIN") {
            // Global summary for Super Admin
            const b = await db.select({ id: branches.id }).from(branches)
            branchIds = b.map(br => br.id)
        }

        if (branchIds.length === 0) {
            return NextResponse.json({ error: "No branches selected" }, { status: 400 })
        }

        // 2. Date/Period parsing
        let startDate = startDateParam ? new Date(startDateParam) : new Date("2020-01-01")
        let endDate = endDateParam ? new Date(endDateParam) : new Date()

        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)

        // Get unique YYYY-MM periods from the date range to query budgets table
        const periods = new Set<string>()
        let curr = new Date(startDate)
        while (curr <= endDate) {
            periods.add(curr.toISOString().slice(0, 7))
            curr.setMonth(curr.getMonth() + 1)
        }
        const periodList = Array.from(periods)

        // 3. Fetch All Relevant Branches with Baselines
        const activeBranches = await db
            .select({
                id: branches.id,
                name: branches.name,
                baselineBudgetCents: branches.baselineBudgetCents,
            })
            .from(branches)
            .where(inArray(branches.id, branchIds))

        const branchMap = new Map(activeBranches.map(b => [b.id, b]))

        // 4. Fetch Budget Allocations for the selected branches and periods
        const budgetRecords = await db
            .select({
                id: budgets.id,
                branchId: budgets.branchId,
                period: budgets.period,
                amountAllocatedCents: budgets.amountAllocatedCents,
                amountSpentCents: budgets.amountSpentCents,
                amountHeldCents: budgets.amountHeldCents,
                amountCreditedCents: budgets.amountCreditedCents,
            })
            .from(budgets)
            .where(
                and(
                    inArray(budgets.branchId, branchIds),
                    inArray(budgets.period, periodList)
                )
            )

        // Create a lookup for budget records: branchId -> period -> record
        const budgetLookup: Record<number, Record<string, any>> = {}
        budgetRecords.forEach(r => {
            if (!budgetLookup[r.branchId]) budgetLookup[r.branchId] = {}
            budgetLookup[r.branchId][r.period] = r
        })

        let totalAllocated = 0
        let totalSpent = 0
        let totalHeld = 0
        let totalCredited = 0

        // Calculate totals by iterating over all selected branches and selected periods
        activeBranches.forEach(branch => {
            periodList.forEach(period => {
                const record = budgetLookup[branch.id]?.[period]
                
                // If record exists, use its values
                // If no record exists, use branch baseline for allocation
                const allocated = record ? (record.amountAllocatedCents || 0) : (branch.baselineBudgetCents || 0)
                const spent = record ? (record.amountSpentCents || 0) : 0
                const held = record ? (record.amountHeldCents || 0) : 0
                const credited = record ? (record.amountCreditedCents || 0) : 0

                totalAllocated += allocated
                totalSpent += spent
                totalHeld += held
                totalCredited += credited
            })
        })

        const totalRemaining = (totalAllocated + totalCredited) - (totalSpent + totalHeld)

        // 5. Fetch Category Breakdown of Spending
        // We calculate spending based on FULFILLED orders in this date range
        const categorySpendingRows = await db
            .select({
                categoryId: globalProducts.categoryId,
                categoryName: categories.name,
                spentCents: sql<number>`SUM(${orderItems.priceCents} * ${orderItems.quantity})`.mapWith(Number)
            })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .innerJoin(globalProducts, eq(orderItems.globalProductId, globalProducts.id))
            .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
            .where(
                and(
                    inArray(orders.branchId, branchIds),
                    gte(orders.createdAt, startDate),
                    lte(orders.createdAt, endDate),
                    inArray(orders.status, ['FULFILLED']) // Only FULFILLED = actually spent, APPROVED = held
                )
            )
            .groupBy(globalProducts.categoryId, categories.name)
            .orderBy(desc(sql`SUM(${orderItems.priceCents} * ${orderItems.quantity})`))

        // 5. MoM Insights calculation (Previous Period)
        const rangeDurationMs = endDate.getTime() - startDate.getTime()
        const prevEndDate = new Date(startDate.getTime() - 1)
        const prevStartDate = new Date(prevEndDate.getTime() - rangeDurationMs)

        const prevPeriods = new Set<string>()
        curr = new Date(prevStartDate)
        while (curr <= prevEndDate) {
            prevPeriods.add(curr.toISOString().slice(0, 7))
            curr.setMonth(curr.getMonth() + 1)
        }
        const prevPeriodList = Array.from(prevPeriods)

        const prevBudgetRecords = await db.select().from(budgets).where(
            and(
                inArray(budgets.branchId, branchIds),
                inArray(budgets.period, prevPeriodList)
            )
        )

        let prevTotalAllocated = 0
        let prevTotalSpent = 0
        let prevTotalHeld = 0
        let prevTotalCredited = 0

        prevBudgetRecords.forEach(b => {
            prevTotalAllocated += b.amountAllocatedCents || 0
            prevTotalSpent += b.amountSpentCents || 0
            prevTotalHeld += b.amountHeldCents || 0
            prevTotalCredited += b.amountCreditedCents || 0
        })

        const prevTotalRemaining = (prevTotalAllocated + prevTotalCredited) - (prevTotalSpent + prevTotalHeld)

        // Calculate deltas
        const spentGrowth = prevTotalSpent > 0 ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100 : 0
        const allocationGrowth = prevTotalAllocated > 0 ? ((totalAllocated - prevTotalAllocated) / prevTotalAllocated) * 100 : 0

        // 6. Unified Chart Data (Allocation + Spending)
        const chartDataMap: Record<string, any> = {}

        // Initialize map with all periods in range
        periods.forEach(p => {
            chartDataMap[p] = { period: p, branches: {} }
        })

        // Add allocation data (considering ALL branches for ALL periods)
        activeBranches.forEach(branch => {
            periodList.forEach(period => {
                if (!chartDataMap[period]) return
                
                const record = budgetLookup[branch.id]?.[period]
                const baselineSetting = branch.baselineBudgetCents || 0
                const allocated = record ? (record.amountAllocatedCents || 0) : baselineSetting
                const credited = record ? (record.amountCreditedCents || 0) : 0
                
                // For the chart, we split into baseline vs addon explicitly based on DB fields
                const baseline = allocated
                const addon = credited
                
                if (!chartDataMap[period].branches[branch.id]) {
                    chartDataMap[period].branches[branch.id] = { branchName: branch.name, baseline: 0, addon: 0, spent: 0 }
                }
                chartDataMap[period].branches[branch.id].baseline += baseline
                chartDataMap[period].branches[branch.id].addon += addon
            })
        })

        // Add spending data
        const spendingRows = await db
            .select({
                period: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
                branchId: orders.branchId,
                spentCents: sql<number>`SUM(${orders.totalCents})`.mapWith(Number)
            })
            .from(orders)
            .where(
                and(
                    inArray(orders.branchId, branchIds),
                    gte(orders.createdAt, startDate),
                    lte(orders.createdAt, endDate),
                    inArray(sql`UPPER(${orders.status})`, ['FULFILLED'])
                )
            )
            .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`, orders.branchId)

        spendingRows.forEach(s => {
            const p = s.period
            if (!chartDataMap[p]) return
            if (!chartDataMap[p].branches[s.branchId]) {
                const b = branchMap.get(s.branchId)
                chartDataMap[p].branches[s.branchId] = { branchName: b?.name || `Branch #${s.branchId}`, baseline: 0, addon: 0, spent: 0 }
            }
            chartDataMap[p].branches[s.branchId].spent += s.spentCents
        })

        // Format for response based on granularity
        let finalChartData = Object.values(chartDataMap).sort((a, b) => a.period.localeCompare(b.period))

        if (granularity === "yearly") {
            const yearlyMap: Record<string, any> = {}
            finalChartData.forEach(d => {
                const year = d.period.slice(0, 4)
                if (!yearlyMap[year]) yearlyMap[year] = { date: year, branches: {} }
                Object.entries(d.branches).forEach(([bid, bdata]: [string, any]) => {
                    if (!yearlyMap[year].branches[bid]) {
                        yearlyMap[year].branches[bid] = { ...bdata }
                    } else {
                        yearlyMap[year].branches[bid].baseline += bdata.baseline
                        yearlyMap[year].branches[bid].addon += bdata.addon
                        yearlyMap[year].branches[bid].spent += bdata.spent
                    }
                })
            })
            finalChartData = Object.values(yearlyMap).map(d => ({
                date: d.date,
                branches: Object.entries(d.branches).map(([id, data]: [string, any]) => ({ branchId: id, ...data }))
            }))
        } else {
            finalChartData = finalChartData.map(d => ({
                date: d.period,
                branches: Object.entries(d.branches).map(([id, data]: [string, any]) => ({ branchId: id, ...data }))
            }))
        }

        // 7. Branch Breakdown (Including all selected branches)
        const branchBreakdown = activeBranches.map(branch => {
            let allocated = 0
            let spent = 0
            let held = 0
            let credited = 0

            periodList.forEach(period => {
                const record = budgetLookup[branch.id]?.[period]
                allocated += record ? (record.amountAllocatedCents || 0) : (branch.baselineBudgetCents || 0)
                spent += record ? (record.amountSpentCents || 0) : 0
                held += record ? (record.amountHeldCents || 0) : 0
                credited += record ? (record.amountCreditedCents || 0) : 0
            })

            return {
                branchId: branch.id,
                branchName: branch.name,
                allocated,
                spent,
                held,
                credited,
                remaining: (allocated + credited) - (spent + held),
                baselineAmount: branch.baselineBudgetCents || 0
            }
        })

        return NextResponse.json({
            summary: {
                totalAllocated,
                totalSpent,
                totalHeld,
                totalCredited,
                totalRemaining
            },
            previousSummary: {
                totalAllocated: prevTotalAllocated,
                totalSpent: prevTotalSpent,
                totalHeld: prevTotalHeld,
                totalCredited: prevTotalCredited,
                totalRemaining: prevTotalRemaining
            },
            insights: {
                spentGrowth,
                allocationGrowth
            },
            categories: categorySpendingRows,
            chartData: finalChartData,
            branchBreakdown
        })
    } catch (error: any) {
        console.error("Budget Summary API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
