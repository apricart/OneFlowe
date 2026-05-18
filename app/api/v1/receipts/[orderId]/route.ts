import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, refunds, refundItems, orderItems } from "@/db/schema"
import { eq } from "drizzle-orm"
import { shouldHidePricesForRole, redactReceiptPrices } from "@/lib/price-visibility"

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

        const { verifyResourceAccess } = await import("@/lib/auth")
        const hasAccess = await verifyResourceAccess(order.organizationId, order.branchId)
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden: You do not have access to this receipt" }, { status: 403 })
        }

        const userRole = (session.user as any).role
        const pricesHidden = await shouldHidePricesForRole(userRole, order.organizationId)

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
                        amount: pricesHidden ? null : (item.refundedAmount || 0) / 100,
                    })
                }
            } else {
                acc.push({
                    refundId: item.refundId,
                    amount: pricesHidden ? null : (item.refundAmount || 0) / 100,
                    reason: item.refundReason || "",
                    status: item.refundStatus || "PENDING",
                    createdAt: item.refundCreatedAt || new Date(),
                    items: item.orderItemId ? [{
                        orderItemId: item.orderItemId,
                        productName: item.productName || "Unknown",
                        quantity: item.refundedQuantity || 0,
                        amount: pricesHidden ? null : (item.refundedAmount || 0) / 100,
                    }] : [],
                })
            }
            return acc
        }, [] as Array<{
            refundId: number
            amount: number | null
            reason: string
            status: string
            createdAt: Date
            items: Array<{
                orderItemId: number
                productName: string
                quantity: number
                amount: number | null
            }>
        }>)

        // Dynamically override receipt data status with actual order status for accuracy
        const finalReceiptData = order.receiptData ? {
            ...(order.receiptData as any),
            status: order.status
        } : null
        const safeReceiptData = pricesHidden ? redactReceiptPrices(finalReceiptData) : finalReceiptData

        return NextResponse.json({
            orderId: order.id,
            orderTid: order.tid,
            status: order.status,
            receiptData: safeReceiptData,
            refundHistory,
            totalRefundAmount: pricesHidden ? null : (order.refundAmountCents || 0) / 100,
            pricesHidden,
        })
    } catch (e: any) {
        console.error("Receipt retrieval error:", e)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
