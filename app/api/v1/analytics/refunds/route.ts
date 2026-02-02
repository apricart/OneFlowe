import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { eq, and, gte, lte, or, gt, sql, inArray } from "drizzle-orm"

/**
 * GET /api/v1/analytics/refunds
 * Returns refunded orders for the refund order report
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const organizationId = searchParams.get("organizationId")
        const branchId = searchParams.get("branchId")
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")
        const groupId = searchParams.get("groupId")

        // Build conditions - only include orders with refunds
        const conditions: any[] = [
            or(
                eq(orders.status, "REFUNDED"),
                gt(orders.refundAmountCents, 0)
            )
        ]

        if (organizationId) {
            conditions.push(eq(orders.organizationId, parseInt(organizationId)))
        }

        if (branchId) {
            conditions.push(eq(orders.branchId, parseInt(branchId)))
        }

        if (startDate) {
            conditions.push(gte(orders.refundedAt, new Date(startDate)))
        }

        if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            conditions.push(lte(orders.refundedAt, end))
        }

        // If groupId is specified, get all branch IDs in that group
        if (groupId && groupId !== "all") {
            console.log(`[Analytics Refunds] Filtering by groupId: ${groupId}`)
            // Branches have groupId column - find all branches in this group
            const branchesInGroup = await db
                .select({ id: branches.id })
                .from(branches)
                .where(eq(branches.groupId, parseInt(groupId)))

            console.log(`[Analytics Refunds] Found ${branchesInGroup.length} branches in group ${groupId}:`, branchesInGroup.map(b => b.id))

            if (branchesInGroup.length > 0) {
                const branchIds = branchesInGroup.map(b => b.id)
                conditions.push(inArray(orders.branchId, branchIds))
            } else {
                // No branches in group, return empty
                console.log(`[Analytics Refunds] No branches found in group ${groupId}, returning empty`)
                return NextResponse.json({ items: [], count: 0 })
            }
        }

        // Query refunded orders with branch name
        const refundedOrders = await db
            .select({
                id: orders.id,
                tid: orders.tid,
                branchId: orders.branchId,
                branchName: branches.name,
                status: orders.status,
                statusAtRefund: orders.statusAtRefund,
                orderTotal: orders.totalCents,
                refundAmount: orders.refundAmountCents,
                reason: orders.refundReason,
                createdAt: orders.createdAt,
                refundedAt: orders.refundedAt,
            })
            .from(orders)
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(and(...conditions))
            .orderBy(sql`${orders.refundedAt} DESC NULLS LAST`)
            .limit(500)

        // Add refund type (FULL or PARTIAL)
        const itemsWithType = refundedOrders.map(order => ({
            ...order,
            refundType: (order.refundAmount || 0) >= (order.orderTotal || 0) ? "FULL" : "PARTIAL"
        }))

        return NextResponse.json({
            items: itemsWithType,
            count: itemsWithType.length
        })

    } catch (error: any) {
        console.error("[Analytics Refunds] Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch refund data", details: error?.message },
            { status: 500 }
        )
    }
}
