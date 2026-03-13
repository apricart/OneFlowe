import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, users, branches, roles } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc, sql } from "drizzle-orm"

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

        let startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        let endDate = endDateParam ? new Date(endDateParam) : new Date()
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)

        // Aggregate User Metrics
        const q = db
            .select({
                userId: users.id,
                userName: users.fullName,
                userEmail: users.email,
                employeeId: users.employeeId,
                branchName: branches.name,
                totalOrders: sql<number>`count(${orders.id})`,
                fulfilledOrders: sql<number>`count(CASE WHEN ${orders.status} IN ('FULFILLED', 'APPROVED') THEN 1 END)`,
                refundedOrders: sql<number>`count(CASE WHEN ${orders.status} = 'REFUNDED' THEN 1 END)`,
                totalSpentCents: sql<number>`sum(CASE WHEN ${orders.status} IN ('FULFILLED', 'APPROVED') THEN ${orders.totalCents} ELSE 0 END)`,
            })
            .from(users)
            .innerJoin(orders, eq(orders.createdByUserId, users.id))
            .leftJoin(branches, eq(users.branchId, branches.id))
            .where(
                and(
                    inArray(orders.branchId, branchIds),
                    gte(orders.createdAt, startDate),
                    lte(orders.createdAt, endDate)
                )
            )
            .groupBy(users.id, branches.name)
            .orderBy(desc(sql`sum(CASE WHEN ${orders.status} IN ('FULFILLED', 'APPROVED') THEN ${orders.totalCents} ELSE 0 END)`))

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

            const compResults = await db
                .select({
                    orderId: orders.id,
                    status: orders.status,
                    totalSpentCents: orders.totalCents,
                    userId: orders.createdByUserId
                })
                .from(orders)
                .where(
                    and(
                        inArray(orders.branchId, branchIds),
                        gte(orders.createdAt, prevStart),
                        lte(orders.createdAt, prevEnd)
                    )
                )

            let compOrders = compResults.length
            let compFulfilled = compResults.filter(r => ['FULFILLED', 'APPROVED'].includes(r.status || "")).length
            let compSpent = compResults.reduce((sum, r) => sum + (['FULFILLED', 'APPROVED'].includes(r.status || "") ? (r.totalSpentCents || 0) : 0), 0)
            let compUsers = new Set(compResults.map(r => r.userId)).size

            comparisonSummary = {
                totalOrders: compOrders,
                totalFulfilled: compFulfilled,
                totalSpentCents: compSpent,
                totalUsers: compUsers
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
