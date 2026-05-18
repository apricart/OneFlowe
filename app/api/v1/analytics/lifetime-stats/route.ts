import { NextRequest } from "next/server"
import { sql, and, eq } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"
import { metricExpressions } from "@/lib/metric-utils"
import { redactAnalyticsPrices, shouldHidePricesForRole } from "@/lib/price-visibility"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const

type Role = typeof allowedRoles[number]

export async function GET(req: NextRequest) {
    const err = await requireApiRole(allowedRoles as any)
    if (err) return err

    const scope = await getRequestScope()
    const role = scope?.role

    // Get filter parameters from query string
    const { searchParams } = new URL(req.url)
    const orgIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")
    const groupIdParam = searchParams.get("groupId")

    // Use query params if provided, otherwise fall back to auth scope
    let organizationId: number | null = null
    let branchId: number | null = null
    let groupId: number | null = null

    if (orgIdParam && orgIdParam !== "null" && orgIdParam !== "0") {
        organizationId = Number(orgIdParam)
    } else if (role !== "SUPER_ADMIN" && scope?.organizationId) {
        organizationId = scope.organizationId
    }

    if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
        branchId = Number(branchIdParam)
    } else if (role === "BRANCH_ADMIN" && scope?.branchId) {
        branchId = scope.branchId
    }

    if (groupIdParam && groupIdParam !== "null" && groupIdParam !== "0") {
        groupId = Number(groupIdParam)
    }
    const pricesHidden = await shouldHidePricesForRole(role, scope?.organizationId)

    // Build conditions — query ALL orders, use CASE WHEN for revenue
    const conditions: any[] = []

    // Apply organization filter
    if (organizationId) {
        conditions.push(eq(orders.organizationId, organizationId))
    }

    // Apply branch filter
    if (branchId) {
        conditions.push(eq(orders.branchId, branchId))
    }

    // Apply group filter
    if (groupId) {
        conditions.push(eq(branches.groupId, groupId))
    }

    // Query lifetime statistics — all orders, unified revenue
    const whereClause = conditions.length > 0 ? and(...(conditions as any)) : undefined
    const [stats] = await db
        .select({
            totalOrders: sql<number>`COUNT(*)::int`,
            fulfilledOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)::int`,
            refundedOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END)::int`,
            rejectedOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END)::int`,
            approvedOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'APPROVED' THEN 1 END)::int`,
            // Revenue = net fulfilled value (FULFILLED + REFUNDED, minus refund amounts)
            totalRevenueCents: metricExpressions.revenue,
            // Gross revenue (FULFILLED + REFUNDED orders total before refund deductions)
            grossRevenueCents: sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED') THEN ${orders.totalCents} ELSE 0 END), 0)::bigint`,
            // Total refunded amount
            totalRefundedCents: sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED') THEN COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END), 0)::bigint`,
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(whereClause)

    const payload = {
        totalOrders: Number(stats?.totalOrders || 0),
        fulfilledOrders: Number(stats?.fulfilledOrders || 0),
        refundedOrders: Number(stats?.refundedOrders || 0),
        rejectedOrders: Number(stats?.rejectedOrders || 0),
        approvedOrders: Number(stats?.approvedOrders || 0),
        totalRevenue: Number(stats?.totalRevenueCents || 0) / 100,
        grossRevenue: Number(stats?.grossRevenueCents || 0) / 100,
        totalRefunded: Number(stats?.totalRefundedCents || 0) / 100,
        pricesHidden,
    }

    return ok(pricesHidden ? redactAnalyticsPrices(payload) : payload)
}
