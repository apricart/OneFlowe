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

        const userRole = ((session.user as any).role || "").toUpperCase()
        const userOrgId = (session.user as any).organizationId
        const userBranchId = (session.user as any).branchId

        const url = new URL(req.url)
        const startDateParam = url.searchParams.get("startDate")
        const endDateParam = url.searchParams.get("endDate")
        const branchIdsParam = url.searchParams.get("branchIds")

        // RBAC Context Parsing
        let branchIds: number[] = []
        if (branchIdsParam) {
            branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id))
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
        let refundQuantities: Record<number, number> = {}

        if (validOrderItemIds.length > 0) {
            const refundsObj = await db
                .select({
                    orderItemId: refundItems.orderItemId,
                    qty: refundItems.quantity,
                })
                .from(refundItems)
                .where(inArray(refundItems.orderItemId, validOrderItemIds))

            refundQuantities = refundsObj.reduce((acc, curr) => {
                if (curr.orderItemId) {
                    acc[curr.orderItemId] = (acc[curr.orderItemId] || 0) + curr.qty
                }
                return acc
            }, {} as Record<number, number>)
        }

        const flattened = results.map(row => {
            const refundedCount = refundQuantities[row.orderItemId] || 0

            let qtyDelivered = 0
            let valueFulfilledCents = 0
            let valueRefundedCents = 0
            let valueRejectedCents = 0
            let valuePendingCents = 0

            const totalItemValue = row.qtyOrdered * row.priceCents

            if (row.status === 'FULFILLED') {
                qtyDelivered = row.qtyOrdered
                valueFulfilledCents = totalItemValue
            } else if (row.status === 'APPROVED') {
                // Approved items are processed but not yet fulfilled = Revenue Pending
                valuePendingCents = totalItemValue
            } else if (row.status === 'REFUNDED') {
                qtyDelivered = Math.max(0, row.qtyOrdered - refundedCount)
                valueFulfilledCents = qtyDelivered * row.priceCents
                valueRefundedCents = refundedCount * row.priceCents
            } else if (row.status === 'REJECTED' || row.status === 'CANCELLED') {
                valueRejectedCents = totalItemValue
            } else if (row.status === 'PENDING') {
                valuePendingCents = totalItemValue
            }

            return {
                id: row.orderItemId,
                tid: row.tid,
                orderId: row.orderId,
                status: row.status,
                orderCreatedAt: row.orderCreatedAt,
                userId: row.userId,
                empNumber: row.userId.split('-')[0], // Pseudo employee number
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
                valueDeliveredCents: valueFulfilledCents, // This is exactly what the user wants for "Net Revenue"
                valueRefundedCents,
                valueRejectedCents,
                valuePendingCents
            }
        })

        return NextResponse.json({ data: flattened })
    } catch (error: any) {
        console.error("Orders Itemized Request failed: ", error)
        return NextResponse.json({ error: "Failed to fetch itemized orders" }, { status: 500 })
    }
}
