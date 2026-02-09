import { NextRequest } from "next/server"
import { sql, and, eq } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"

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

    // Build conditions
    const conditions: any[] = [
        // Include APPROVED, FULFILLED, and REFUNDED orders
        sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED')`
    ]

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

    // Query lifetime statistics
    const [stats] = await db
        .select({
            totalOrders: sql<number>`COUNT(*)::int`,
            fulfilledOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)::int`,
            refundedOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END)::int`,
            // Total revenue = sum of all orders minus refunds
            totalRevenueCents: sql<number>`COALESCE(SUM(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)::bigint`,
            // Gross revenue (before refunds)
            grossRevenueCents: sql<number>`COALESCE(SUM(${orders.totalCents}), 0)::bigint`,
            // Total refunded amount
            totalRefundedCents: sql<number>`COALESCE(SUM(${orders.refundAmountCents}), 0)::bigint`,
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(and(...(conditions as any)))

    return ok({
        totalOrders: Number(stats?.totalOrders || 0),
        fulfilledOrders: Number(stats?.fulfilledOrders || 0),
        refundedOrders: Number(stats?.refundedOrders || 0),
        totalRevenue: Number(stats?.totalRevenueCents || 0) / 100, // Convert to PKR
        grossRevenue: Number(stats?.grossRevenueCents || 0) / 100,
        totalRefunded: Number(stats?.totalRefundedCents || 0) / 100,
    })
}
