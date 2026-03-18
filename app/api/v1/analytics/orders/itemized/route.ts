import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, orderItems, branches, users, globalProducts, categories, refundItems } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc } from "drizzle-orm"

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
        const status = url.searchParams.get("status")

        // RBAC Context Parsing
        let branchIds: number[] = []
        if (branchIdsParam && branchIdsParam.trim() !== "") {
            branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        } else if (userRole === "BRANCH_ADMIN" || userRole === "BRANCH_MANAGER" || userRole === "ORDER_PORTAL") {
            if (userBranchId) branchIds = [userBranchId]
        } else {
            const b = await db.select({ id: branches.id }).from(branches).where(userOrgId ? eq(branches.organizationId, userOrgId) : undefined)
            branchIds = b.map(br => br.id)
        }

        if (branchIds.length === 0) {
            return NextResponse.json({ error: "No branches resolved" }, { status: 400 })
        }

        let startDate = startDateParam ? new Date(startDateParam) : new Date()
        let endDate = endDateParam ? new Date(endDateParam) : new Date()
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)

        // Find all order items matching filters
        const q = db
            .select({
                orderId: orders.id,
                tid: orders.tid,
                status: orders.status,
                orderCreatedAt: orders.createdAt,
                userId: users.id,
                userName: users.fullName,
                userEmail: users.email,
                branchName: branches.name,
                itemCode: orderItems.productCode,
                itemName: orderItems.productName,
                itemUnit: orderItems.unit,
                categoryName: categories.name,
                qtyOrdered: orderItems.quantity,
                priceCents: orderItems.priceCents,
                orderItemId: orderItems.id
            })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .innerJoin(users, eq(orders.createdByUserId, users.id))
            .innerJoin(branches, eq(orders.branchId, branches.id))
            .innerJoin(globalProducts, eq(orderItems.globalProductId, globalProducts.id))
            .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
            .where(
                and(
                    inArray(orders.branchId, branchIds),
                    gte(orders.createdAt, startDate),
                    lte(orders.createdAt, endDate),
                    inArray(orders.status, ['FULFILLED', 'APPROVED', 'REFUNDED', 'PENDING', 'REJECTED', 'CANCELLED'])
                )
            )
            .orderBy(desc(orders.createdAt))

        const results = await q

        // Get refund data for calculating exact valid quantities
        const validOrderItemIds = results.map(r => r.orderItemId)
        let refundQuantities: Record<number, { qty: number; amount: number }> = {}

        if (validOrderItemIds.length > 0) {
            const refundsObj = await db
                .select({
                    orderItemId: refundItems.orderItemId,
                    qty: refundItems.quantity,
                    amount: refundItems.amountCents,
                })
                .from(refundItems)
                .where(inArray(refundItems.orderItemId, validOrderItemIds))

            refundQuantities = refundsObj.reduce((acc, curr) => {
                if (curr.orderItemId) {
                    acc[curr.orderItemId] = {
                        qty: (acc[curr.orderItemId]?.qty || 0) + curr.qty,
                        amount: (acc[curr.orderItemId]?.amount || 0) + (curr.amount || 0)
                    }
                }
                return acc
            }, {} as Record<number, { qty: number, amount: number }>)
        }

        const flattened = results.map(row => {
            const refundData = refundQuantities[row.orderItemId] || { qty: 0, amount: 0 }
            const totalItemValue = row.qtyOrdered * row.priceCents

            // Cap refunds at item total to prevent "Refund > Subtotal" errors
            const valueRefundedCents = Math.min(totalItemValue, refundData.amount || (refundData.qty * row.priceCents))
            const effectiveRefundedQty = Math.min(row.qtyOrdered, refundData.qty)

            let qtyDelivered = row.qtyOrdered
            let valueFulfilledCents = 0
            let valueRejectedCents = 0
            let valuePendingCents = 0

            if (row.status === 'FULFILLED' || row.status === 'REFUNDED' || row.status === 'APPROVED') {
                qtyDelivered = Math.max(0, row.qtyOrdered - effectiveRefundedQty)
                valueFulfilledCents = Math.max(0, totalItemValue - valueRefundedCents)
            } else if (row.status === 'REJECTED' || row.status === 'CANCELLED') {
                valueRejectedCents = totalItemValue
                qtyDelivered = 0
            } else if (row.status === 'PENDING') {
                valuePendingCents = totalItemValue
                qtyDelivered = 0
            }

            return {
                id: row.orderItemId,
                tid: row.tid,
                orderId: row.orderId,
                status: row.status,
                orderCreatedAt: row.orderCreatedAt,
                userId: row.userId,
                empNumber: row.userId.split('-')[0],
                userName: row.userName || row.userEmail?.split('@')[0],
                userEmail: row.userEmail,
                group: row.branchName,
                itemCode: row.itemCode || 'Unknown',
                itemCategory: row.categoryName || 'Uncategorized',
                itemDetails: row.itemName,
                unit: row.itemUnit,
                unitRateCents: row.priceCents,
                qtyOrdered: row.qtyOrdered,
                qtyDelivered: qtyDelivered,
                priceCents: row.priceCents,
                subtotalCents: totalItemValue,
                refundAmountCents: valueRefundedCents,
                netTotalCents: (row.status === 'REJECTED' || row.status === 'CANCELLED') ? 0 : valueFulfilledCents,
                valueFulfilledCents,
                valueDeliveredCents: valueFulfilledCents,
                valueRefundedCents,
                valueRejectedCents,
                valuePendingCents
            }
        })

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
                    id: orders.id,
                    status: orders.status,
                    totalCents: orders.totalCents,
                    refundAmountCents: orders.refundAmountCents
                })
                .from(orders)
                .where(
                    and(
                        inArray(orders.branchId, branchIds),
                        gte(orders.createdAt, prevStart),
                        lte(orders.createdAt, prevEnd)
                    )
                )

            const compFulfilled = compResults.filter(r => ['FULFILLED', 'REFUNDED', 'APPROVED'].includes(r.status || ""))
            const compRejected = compResults.filter(r => ['REJECTED', 'CANCELLED'].includes(r.status || ""))

            comparisonSummary = {
                totalOrders: compResults.length,
                totalRevenue: compFulfilled.reduce((sum, r) => sum + ((r.totalCents || 0) - (r.refundAmountCents || 0)), 0),
                totalRejected: compRejected.reduce((sum, r) => sum + (r.totalCents || 0), 0),
                totalRefunded: compResults.reduce((sum, r) => sum + (r.refundAmountCents || 0), 0)
            }
        }

        return NextResponse.json({
            data: flattened,
            comparison: comparisonSummary
        })
    } catch (error: any) {
        console.error("Orders Itemized Request failed: ", error)
        return NextResponse.json({ error: "Failed to fetch itemized orders" }, { status: 500 })
    }
}
