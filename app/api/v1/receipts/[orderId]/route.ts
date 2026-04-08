import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { orders, refunds, refundItems, orderItems } from "@/db/schema"
import { eq, and } from "drizzle-orm"

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

        const user = session.user as any
        const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

        const result = await runner(async (tx: any) => {
            // Fetch order with receipt data
            const [order] = await tx
                .select()
                .from(orders)
                .where(eq(orders.id, orderId))
                .limit(1)

            if (!order) {
                return null
            }

            // BOLA check for Branch Admin (already handled by RLS if withTenant, but good for explicit error)
            if (user.role === "BRANCH_ADMIN" && order.branchId !== user.branchId) {
                throw new Error("Forbidden - Access to this order's receipt is denied")
            }

            // Fetch refund information
            const refundData = await tx
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

            return { order, refundData }
        })

        if (!result) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        const { order, refundData } = result as { order: any, refundData: any[] }

        // Group refund items by refund
        const refundHistory = refundData.reduce((acc: any[], item: any) => {
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
        }, [])

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
        const status = e.message.includes("Forbidden") ? 403 : 500
        return NextResponse.json(
            { error: e.message || "Internal Server Error" },
            { status }
        )
    }
}

