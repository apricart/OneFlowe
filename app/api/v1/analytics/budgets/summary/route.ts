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
        const userRole = ((session.user as any).role || "").toUpperCase()
        const userOrgId = (session.user as any).organizationId
        const userBranchId = (session.user as any).branchId

        const url = new URL(req.url)
        const startDateParam = url.searchParams.get("startDate")
        const endDateParam = url.searchParams.get("endDate")
        const branchIdsParam = url.searchParams.get("branchIds")
        const branchIdParam = url.searchParams.get("branchId")
        const organizationIdParam = url.searchParams.get("organizationId")

        // 1. RBAC Check and Branch/Org Resolution
        let allowedOrgId = userOrgId
        if (userRole === "SUPER_ADMIN" && organizationIdParam) {
            allowedOrgId = Number(organizationIdParam)
        }

        let branchIds: number[] = []
        if (branchIdsParam) {
            branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id))
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
        let startDate = startDateParam ? new Date(startDateParam) : new Date()
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

        // 3. Fetch Budget Allocations for the selected branches and periods
        const budgetRecords = await db
            .select({
                id: budgets.id,
                branchId: budgets.branchId,
                branchName: branches.name,
                period: budgets.period,
                amountAllocatedCents: budgets.amountAllocatedCents,
                amountSpentCents: budgets.amountSpentCents,
                amountHeldCents: budgets.amountHeldCents,
                amountCreditedCents: budgets.amountCreditedCents,
            })
            .from(budgets)
            .leftJoin(branches, eq(budgets.branchId, branches.id))
            .where(
                and(
                    inArray(budgets.branchId, branchIds),
                    inArray(budgets.period, periodList)
                )
            )

        let totalAllocated = 0
        let totalSpent = 0
        let totalHeld = 0
        let totalCredited = 0

        budgetRecords.forEach(b => {
            totalAllocated += b.amountAllocatedCents || 0
            totalSpent += b.amountSpentCents || 0
            totalHeld += b.amountHeldCents || 0
            totalCredited += b.amountCreditedCents || 0
        })

        const totalRemaining = (totalAllocated + totalCredited) - (totalSpent + totalHeld)

        // 4. Fetch Category Breakdown of Spending
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
                    inArray(orders.status, ['FULFILLED', 'APPROVED']) // APPROVED = held, FULFILLED = spent
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

        // 6. Daily Spending Chart Data
        const dailySpendingRows = await db
            .select({
                date: sql<string>`DATE(${orders.createdAt})`.mapWith(String),
                spentCents: sql<number>`SUM(${orders.totalCents})`.mapWith(Number)
            })
            .from(orders)
            .where(
                and(
                    inArray(orders.branchId, branchIds),
                    gte(orders.createdAt, startDate),
                    lte(orders.createdAt, endDate),
                    inArray(orders.status, ['FULFILLED', 'APPROVED'])
                )
            )
            .groupBy(sql`DATE(${orders.createdAt})`)
            .orderBy(sql`DATE(${orders.createdAt})`)

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
            dailySpending: dailySpendingRows,
            branchBreakdown: Object.values(budgetRecords.reduce((acc: any, b) => {
                const id = b.branchId;
                if (!acc[id]) {
                    acc[id] = {
                        branchId: id,
                        branchName: b.branchName || `Branch #${id}`,
                        allocated: 0,
                        spent: 0,
                        held: 0,
                        credited: 0,
                        remaining: 0
                    };
                }
                const record = acc[id];
                record.allocated += (b.amountAllocatedCents || 0);
                record.spent += (b.amountSpentCents || 0);
                record.held += (b.amountHeldCents || 0);
                record.credited += (b.amountCreditedCents || 0);
                record.remaining = (record.allocated + record.credited) - (record.spent + record.held);
                return acc;
            }, {})) as any[]
        })
    } catch (error: any) {
        console.error("Budget Summary API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
