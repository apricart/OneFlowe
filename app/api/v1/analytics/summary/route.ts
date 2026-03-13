import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, users, roles, branches, organizations, groups, orderItems } from "@/db/schema"
import { and, desc, eq, gte, lte, sql, sum, count, inArray } from "drizzle-orm"

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
    const branchIdsRaw = url.searchParams.get("branchIds")
    const organizationId = url.searchParams.get("organizationId")
    const groupId = url.searchParams.get("groupId")
    const statusParam = url.searchParams.get("status")
    const compare = url.searchParams.get("compare") === "true"
    const compareStartDateParam = url.searchParams.get("compareStartDate")
    const compareEndDateParam = url.searchParams.get("compareEndDate")

    // Parsing branchIds
    const parsedBranchIds = branchIdsRaw
        ? branchIdsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        : []

    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const conditions = []

    // Status filter
    if (statusParam && statusParam.toLowerCase() !== "all") {
        if (statusParam.toUpperCase() === "REJECTED") {
            conditions.push(sql`UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED')`)
        } else {
            conditions.push(eq(sql`UPPER(${orders.status})`, statusParam.toUpperCase()))
        }
    }

    // Security: RBAC
    const normalizedRole = (roleName || "").toUpperCase().replace(/\s+/g, '_')
    console.log(`[Summary API] User: ${userId}, Role: ${normalizedRole}, Params: Branch=${branchId}, Org=${organizationId}, Group=${groupId}`)

    if (normalizedRole === "SUPER_ADMIN") {
        if (organizationId && organizationId !== "null" && organizationId !== "undefined" && organizationId !== "0") {
            const orgId = Number(organizationId)
            if (orgId > 0) conditions.push(eq(orders.organizationId, orgId))
        }
        if (parsedBranchIds.length > 0) {
            conditions.push(inArray(orders.branchId, parsedBranchIds))
        } else if (branchId && branchId !== "all" && branchId !== "null") {
            conditions.push(eq(orders.branchId, Number(branchId)))
        }
        if (groupId && groupId !== "all" && groupId !== "null") {
            conditions.push(eq(branches.groupId, Number(groupId)))
        }
    } else if (normalizedRole === "HEAD_OFFICE") {
        if (currentUserOrgId) {
            conditions.push(eq(orders.organizationId, currentUserOrgId))
            if (parsedBranchIds.length > 0) {
                conditions.push(inArray(orders.branchId, parsedBranchIds))
            } else if (branchId && branchId !== "all" && branchId !== "null") {
                conditions.push(eq(orders.branchId, Number(branchId)))
            }
            if (groupId && groupId !== "all" && groupId !== "null") {
                conditions.push(eq(branches.groupId, Number(groupId)))
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

    // COMPARISON LOGIC
    let comparisonSummary = null
    if (compare && startDate && endDate) {
        let prevStart: Date
        let prevEnd: Date
            
        if (compareStartDateParam && compareEndDateParam) {
            prevStart = new Date(compareStartDateParam)
            prevEnd = new Date(compareEndDateParam)
            prevStart.setHours(0, 0, 0, 0)
            prevEnd.setHours(23, 59, 59, 999)
        } else {
            const start = new Date(startDate)
            const end = new Date(endDate)
            const duration = end.getTime() - start.getTime()
            prevStart = new Date(start.getTime() - duration - 1)
            prevEnd = new Date(start.getTime() - 1)
        }

        // Correctly filter out createdAt conditions to avoid overlapping periods
        const compConditions = conditions.filter(c => {
            const str = String(c);
            return !str.includes("createdAt") && !str.includes("created_at");
        })
        compConditions.push(gte(orders.createdAt, prevStart))
        compConditions.push(lte(orders.createdAt, prevEnd))

        const compWhere = and(...compConditions)

        const compSummaryResult = await db.select({
            totalSales: sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN ${orders.totalCents} ELSE 0 END), 0)`.mapWith(Number),
            orderCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END), 0)`.mapWith(Number),
            fulfilledCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END), 0)`.mapWith(Number),
            refundedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END), 0)`.mapWith(Number),
            rejectedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END), 0)`.mapWith(Number),
            approvedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'APPROVED' THEN 1 END), 0)`.mapWith(Number),
        })
            .from(orders)
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(compWhere)

        const compItemsResult = await db.select({
            totalItemsSold: sum(orderItems.quantity)
        })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(compWhere)

        comparisonSummary = {
            totalSales: compSummaryResult[0]?.totalSales || 0,
            totalOrders: compSummaryResult[0]?.orderCount || 0,
            fulfilledCount: compSummaryResult[0]?.fulfilledCount || 0,
            refundedCount: compSummaryResult[0]?.refundedCount || 0,
            rejectedCount: compSummaryResult[0]?.rejectedCount || 0,
            approvedCount: compSummaryResult[0]?.approvedCount || 0,
            totalItemsSold: Number(compItemsResult[0]?.totalItemsSold) || 0
        }
    }
    console.log(`[Summary API] Final where clause established. Filtering logic active.`)

    const isFilteredByStatus = statusParam && statusParam.toLowerCase() !== "all"

    // Aggregation Query
    const summaryResult = await db.select({
        totalSales: isFilteredByStatus
            ? sql<number>`COALESCE(SUM(${orders.totalCents}), 0)`.mapWith(Number)
            : sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN ${orders.totalCents} ELSE 0 END), 0)`.mapWith(Number),
        totalTax: sum(orders.taxCents),
        totalSubtotal: sum(orders.subtotalCents),
        orderCount: isFilteredByStatus
            ? count(orders.id)
            : sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END), 0)`.mapWith(Number),
        totalRefunds: sum(orders.refundAmountCents),
    })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(whereClause)

    // Items Summary (Separate to avoid count multiplication by joins)
    const itemsResult = await db.select({
        totalItemsSold: sum(orderItems.quantity)
    })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(whereClause)

    const summary = {
        ...summaryResult[0],
        totalItemsSold: itemsResult[0]?.totalItemsSold || 0
    }

    // Recent Orders for Table with Branch Name and Pagination
    const recentOrders = await db.select({
        id: orders.id,
        tid: orders.tid,
        status: orders.status,
        totalCents: orders.totalCents,
        subtotalCents: orders.subtotalCents,
        taxCents: orders.taxCents,
        refundAmountCents: orders.refundAmountCents,
        branchId: orders.branchId,
        branchName: branches.name,
        groupName: groups.name,
        organizationName: organizations.name,
        createdAt: orders.createdAt
    })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .leftJoin(organizations, eq(orders.organizationId, organizations.id))
        .leftJoin(groups, eq(branches.groupId, groups.id))
        .where(whereClause)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset)

    // Branch Ranking (Top Performers) aggregated by sales volume
    const topPerformers = await db.select({
        branchId: orders.branchId,
        branchName: branches.name,
        sales: sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN ${orders.totalCents} ELSE 0 END), 0)`.mapWith(Number),
        orderCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END), 0)`.mapWith(Number),
        fulfilledCount: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)`.mapWith(Number),
        rejectedCount: sql<number>`count(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END)`.mapWith(Number),
        refundedCount: sql<number>`count(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END)`.mapWith(Number),
    })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(whereClause)
        .groupBy(orders.branchId, branches.name)
        .orderBy(desc(sql`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN ${orders.totalCents} ELSE 0 END), 0)`))
        .limit(10)

    return NextResponse.json({
        summary: {
            ...summary,
            comparison: comparisonSummary
        },
        orders: recentOrders,
        topPerformers,
        pagination: {
            page,
            limit,
            hasMore: recentOrders.length === limit
        }
    })
}
