import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, users, roles, branches, refunds } from "@/db/schema"
import { and, desc, eq, gte, lte, sql, sum, count } from "drizzle-orm"

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = (session.user as any).id

    // Fetch user context
    let roleName = (session.user as any).role
    let currentUserBranchId = null
    let currentUserOrgId = null

    try {
        const currentUserData = await db.select({
            branchId: users.branchId,
            organizationId: users.organizationId,
            roleName: roles.name
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, userId))
            .limit(1)

        if (currentUserData.length > 0) {
            roleName = currentUserData[0].roleName || roleName
            currentUserBranchId = currentUserData[0].branchId
            currentUserOrgId = currentUserData[0].organizationId
        }
    } catch (e) {
        console.error("Failed to fetch user context", e)
    }

    const url = new URL(req.url)
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")
    const branchId = url.searchParams.get("branchId")
    const organizationId = url.searchParams.get("organizationId")

    const status = url.searchParams.get("status")

    const conditions = []

    // Security: RBAC
    const normalizedRole = roleName ? roleName.toUpperCase() : ""
    console.log(`[Summary API] User: ${userId}, Role: ${normalizedRole}, Params: Branch=${branchId}, Org=${organizationId}, Status=${status}`)

    // Status Filtering Logic
    if (status && status !== "all") {
        conditions.push(eq(sql`UPPER(${orders.status})`, status.toUpperCase()))
    } else {
        // Default behavior: Show "Successful" orders (APPROVED, FULFILLED, PENDING included for general summary)
        conditions.push(sql`UPPER(${orders.status}) IN ('PENDING', 'APPROVED', 'FULFILLED')`)
    }

    if (normalizedRole === "SUPER_ADMIN") {
        if (organizationId && organizationId !== "null" && organizationId !== "undefined") {
            conditions.push(eq(orders.organizationId, Number(organizationId)))
        }
        if (branchId && branchId !== "all" && branchId !== "null") {
            conditions.push(eq(orders.branchId, Number(branchId)))
        }
    } else if (normalizedRole === "HEAD_OFFICE") {
        if (currentUserOrgId) {
            conditions.push(eq(orders.organizationId, currentUserOrgId))
            if (branchId && branchId !== "all" && branchId !== "null") {
                conditions.push(eq(orders.branchId, Number(branchId)))
            }
        }
    } else if (normalizedRole === "BRANCH_ADMIN" || normalizedRole === "BRANCH_MANAGER") {
        if (!currentUserBranchId) {
            return NextResponse.json({ error: "Branch context missing" }, { status: 403 })
        }
        conditions.push(eq(orders.branchId, currentUserBranchId))
    } else {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Date Filtering - Inclusive
    if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        conditions.push(gte(orders.createdAt, start))
    }
    if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        conditions.push(lte(orders.createdAt, end))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    console.log(`[Summary API] Final where clause established. Filtering logic active.`)

    // Aggregation Query
    let summaryResult;
    let items;

    if (status?.toLowerCase() === "refunded") {
        // Special Case: Refunded status pulls from the refunds table for consistency
        const refundSummary = await db.select({
            totalSales: sum(refunds.amountCents),
            totalTax: sql<number>`0`, // Tax is usually not calculated per-refund transaction here
            totalSubtotal: sum(refunds.amountCents),
            orderCount: count(refunds.id),
        })
            .from(refunds)
            .innerJoin(orders, eq(refunds.orderId, orders.id))
            .where(whereClause)

        summaryResult = refundSummary[0];

        // Fetch refund transactions for the table
        items = await db.select({
            id: refunds.id,
            tid: orders.tid,
            status: refunds.status,
            totalCents: refunds.amountCents, // Use refund amount
            branchId: orders.branchId,
            branchName: branches.name,
            createdAt: refunds.createdAt
        })
            .from(refunds)
            .innerJoin(orders, eq(refunds.orderId, orders.id))
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(whereClause)
            .orderBy(desc(refunds.createdAt))
            .limit(50)
    } else {
        // Standard Case: Approved/Fulfilled/Pending
        const standardSummary = await db.select({
            totalSales: sum(orders.totalCents),
            totalTax: sum(orders.taxCents),
            totalSubtotal: sum(orders.subtotalCents),
            orderCount: count(orders.id),
        })
            .from(orders)
            .where(whereClause)

        summaryResult = standardSummary[0];

        items = await db.select({
            id: orders.id,
            tid: orders.tid,
            status: orders.status,
            totalCents: orders.totalCents,
            branchId: orders.branchId,
            branchName: branches.name,
            createdAt: orders.createdAt
        })
            .from(orders)
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(whereClause)
            .orderBy(desc(orders.createdAt))
            .limit(50)
    }

    return NextResponse.json({
        summary: summaryResult,
        orders: items
    })
}
