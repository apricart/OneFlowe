import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, users, branches, roles, organizations } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc, sql } from "drizzle-orm"
import { metricExpressions } from "@/lib/metric-utils"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const userRole = ((session.user as any).role || "").toUpperCase().replace(/\s+/g, '_')
        const userOrgId = (session.user as any).organizationId
        const userBranchId = (session.user as any).branchId

        const url = new URL(req.url)
        const startDateParam = url.searchParams.get("startDate")
        const endDateParam = url.searchParams.get("endDate")
        const branchIdsParam = url.searchParams.get("branchIds")
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

        // RBAC Context Parsing
        let branchIds: number[] = []
        if (branchIdsParam) {
            branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        } else if (userRole === "BRANCH_ADMIN" || userRole === "BRANCH_MANAGER" || userRole === "ORDER_PORTAL") {
            branchIds = [userBranchId]
        } else {
            const b = await db.select({ id: branches.id }).from(branches).where(userOrgId ? eq(branches.organizationId, userOrgId) : undefined)
            branchIds = b.map(br => br.id)
        }

        if (branchIds.length === 0) {
            return NextResponse.json({ error: "No branches resolved" }, { status: 400 })
        }

        let startDate = startDateParam ? new Date(startDateParam) : undefined
        let endDate = endDateParam ? new Date(endDateParam) : undefined
        if (startDate) startDate.setHours(0, 0, 0, 0)
        if (endDate) endDate.setHours(23, 59, 59, 999)

        const baseConditions: any[] = [inArray(orders.branchId, branchIds)]
        
        if (parsedMonths.length > 0) {
            baseConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
        }
        if (parsedYears.length > 0) {
            baseConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
        }

        if (parsedMonths.length === 0 && parsedYears.length === 0) {
            if (startDate) baseConditions.push(gte(orders.createdAt, startDate))
            if (endDate) baseConditions.push(lte(orders.createdAt, endDate))
        }

        // Aggregate User Metrics
        const q = db
            .select({
                userId: users.id,
                userName: users.fullName,
                userEmail: users.email,
                employeeId: sql<string>`COALESCE(${users.employeeId}, SPLIT_PART(${users.id}::text, '-', 1))`,
                branchName: branches.name,
                organizationName: organizations.name,
                tids: sql<string>`STRING_AGG(${orders.tid}, ',')`,
                totalOrders: sql<number>`count(${orders.id})`,
                fulfilledOrders: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)`,
                refundedOrders: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END)`,
                totalSpentCents: metricExpressions.revenue,
            })
            .from(users)
            .innerJoin(orders, eq(orders.createdByUserId, users.id))
            .leftJoin(branches, eq(users.branchId, branches.id))
            .leftJoin(organizations, eq(orders.organizationId, organizations.id))
            .where(and(...baseConditions))
            .groupBy(users.id, branches.name, organizations.name)
            .orderBy(desc(metricExpressions.revenue))

        const results = await q

        // COMPARISON logic for overall KPIs
        let comparisonSummary = null
        if (compare && startDateParam && endDateParam) {
            let prevStart: Date
            let prevEnd: Date
            
            if (compareStartDateParam && compareEndDateParam) {
                prevStart = new Date(compareStartDateParam)
                prevEnd = new Date(compareEndDateParam)
                prevStart.setHours(0, 0, 0, 0)
                prevEnd.setHours(23, 59, 59, 999)
            } else {
                const start = new Date(startDateParam)
                const end = new Date(endDateParam)
                const duration = end.getTime() - start.getTime()
                prevStart = new Date(start.getTime() - duration - 1)
                prevEnd = new Date(start.getTime() - 1)
            }

            const [compStats] = await db
                .select({
                    compOrders: metricExpressions.totalOrderCount,
                    compFulfilled: metricExpressions.fulfilledCount,
                    compSpent: metricExpressions.revenue,
                    compUsers: sql<number>`count(distinct ${orders.createdByUserId})`.mapWith(Number)
                })
                .from(orders)
                .where(
                    and(
                        inArray(orders.branchId, branchIds),
                        (() => {
                            const compCond: any[] = []
                            if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) {
                                if (parsedCompMonths.length > 0) compCond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
                                if (parsedCompYears.length > 0) compCond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
                            } else {
                                if (prevStart) compCond.push(gte(orders.createdAt, prevStart))
                                if (prevEnd) compCond.push(lte(orders.createdAt, prevEnd))
                            }
                            return and(...compCond)
                        })()
                    )
                )

            comparisonSummary = {
                totalOrders: compStats?.compOrders || 0,
                totalFulfilled: compStats?.compFulfilled || 0,
                totalSpentCents: compStats?.compSpent || 0,
                totalUsers: compStats?.compUsers || 0
            }
        }

        return NextResponse.json({
            data: results,
            comparison: comparisonSummary
        })
    } catch (error: any) {
        console.error("User Performance Request failed: ", error)
        return NextResponse.json({ error: "Failed to fetch user performance" }, { status: 500 })
    }
}
