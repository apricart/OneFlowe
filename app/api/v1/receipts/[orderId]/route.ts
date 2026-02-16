import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, refunds, refundItems, orderItems } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ orderId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const params = await props.params
        const orderId = parseInt(params.orderId)
        if (isNaN(orderId)) {
            return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })
        }

        // Fetch order with receipt data
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1)

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        // TODO: Add role-based access control to ensure user can view this order

        // Fetch refund information
        const refundData = await db
            .select({
                refundId: refunds.id,
                refundAmount: refunds.amountCents,
                refundReason: refunds.reason,
                refundStatus: refunds.status,
                refundCreatedAt: refunds.createdAt,
                orderItemId: refundItems.orderItemId,
                refundedQuantity: refundItems.quantity,
                refundedAmount: refundItems.amountCents,
                productName: orderItems.productName,
            })
            .from(refunds)
            .leftJoin(refundItems, eq(refunds.id, refundItems.refundId))
            .leftJoin(orderItems, eq(refundItems.orderItemId, orderItems.id))
            .where(eq(refunds.orderId, orderId))

        // Group refund items by refund
        const refundHistory = refundData.reduce((acc, item) => {
            if (!item.refundId) return acc

            const existing = acc.find(r => r.refundId === item.refundId)
            if (existing) {
                if (item.orderItemId) {
                    existing.items.push({
                        orderItemId: item.orderItemId,
                        productName: item.productName || "Unknown",
                        quantity: item.refundedQuantity || 0,
                        amount: (item.refundedAmount || 0) / 100,
                    })
                }
            } else {
                acc.push({
                    refundId: item.refundId,
                    amount: (item.refundAmount || 0) / 100,
                    reason: item.refundReason || "",
                    status: item.refundStatus || "PENDING",
                    createdAt: item.refundCreatedAt || new Date(),
                    items: item.orderItemId ? [{
                        orderItemId: item.orderItemId,
                        productName: item.productName || "Unknown",
                        quantity: item.refundedQuantity || 0,
                        amount: (item.refundedAmount || 0) / 100,
                    }] : [],
                })
            }
            return acc
        }, [] as Array<{
            refundId: number
            amount: number
            reason: string
            status: string
            createdAt: Date
            items: Array<{
                orderItemId: number
                productName: string
                quantity: number
                amount: number
            }>
        }>)

        return NextResponse.json({
            orderId: order.id,
            orderTid: order.tid,
            status: order.status,
            receiptData: order.receiptData,
            refundHistory,
            totalRefundAmount: (order.refundAmountCents || 0) / 100,
        })
    } catch (e: any) {
        console.error("Receipt retrieval error:", e)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
