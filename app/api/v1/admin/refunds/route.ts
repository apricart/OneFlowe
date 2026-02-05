import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, orderItems, organizations, branches, users, budgets, auditLogs, refunds, refundItems } from "@/db/schema"
import { eq, or, ilike, sql, and, desc } from "drizzle-orm"

/**
 * GET /api/v1/admin/refunds/search?q=<order_tid_or_id>
 * Search for an order by TID or internal ID (Super Admin only)
 */
export async function GET(req: NextRequest) {
    console.log("[Refunds API] GET endpoint called")
    try {
        // Auth check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userRole = (session.user as any).role
        if (userRole !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
        }

        // Get search query
        const { searchParams } = new URL(req.url)
        const query = searchParams.get("q")?.trim()

        if (searchParams.has("status") && searchParams.get("status") === "pending") {
            const pendingRefunds = await db
                .select({
                    id: refunds.id,
                    amountCents: refunds.amountCents,
                    reason: refunds.reason,
                    status: refunds.status,
                    createdAt: refunds.createdAt,
                    orderId: orders.id,
                    tid: orders.tid,
                    totalCents: orders.totalCents,
                    branchName: branches.name,
                    requestedByName: users.fullName,
                })
                .from(refunds)
                .innerJoin(orders, eq(refunds.orderId, orders.id))
                .leftJoin(branches, eq(orders.branchId, branches.id))
                .leftJoin(users, eq(refunds.requestedByUserId, users.id))
                .where(eq(refunds.status, "PENDING"))
                .orderBy(desc(refunds.createdAt))
                .limit(50)

            return NextResponse.json({ refunds: pendingRefunds })
        }

        if (!query) {
            return NextResponse.json({ error: "Search query or status is required" }, { status: 400 })
        }

        // Sanitize and validate input - TID only
        if (query.length > 50) {
            return NextResponse.json({ error: "Search query too long" }, { status: 400 })
        }

        // Search by TID only (case-insensitive)
        const [orderData] = await db
            .select({
                id: orders.id,
                tid: orders.tid,
                organizationId: orders.organizationId,
                branchId: orders.branchId,
                status: orders.status,
                subtotalCents: orders.subtotalCents,
                taxCents: orders.taxCents,
                totalCents: orders.totalCents,
                notes: orders.notes,
                createdAt: orders.createdAt,
                fulfilledAt: orders.fulfilledAt,
                approvedAt: orders.approvedAt,
                statusAtRefund: orders.statusAtRefund,
                refundedAt: orders.refundedAt,
                refundAmountCents: orders.refundAmountCents,
                refundReason: orders.refundReason,
                createdByUserId: orders.createdByUserId,
            })
            .from(orders)
            .where(ilike(orders.tid, `%${query}%`))
            .limit(1)

        if (!orderData) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        // Get organization and branch names
        const [org] = await db
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, orderData.organizationId!))
            .limit(1)

        const [branch] = await db
            .select({ name: branches.name })
            .from(branches)
            .where(eq(branches.id, orderData.branchId))
            .limit(1)

        // Get user name
        const [user] = await db
            .select({ fullName: users.fullName, email: users.email })
            .from(users)
            .where(eq(users.id, orderData.createdByUserId))
            .limit(1)

        // Get order items
        const items = await db
            .select({
                id: orderItems.id,
                productName: orderItems.productName,
                productCode: orderItems.productCode,
                quantity: orderItems.quantity,
                priceCents: orderItems.priceCents,
                unit: orderItems.unit,
            })
            .from(orderItems)
            .where(eq(orderItems.orderId, orderData.id))

        // Fetch already refunded quantities
        const refundedItemsData = await db
            .select({
                orderItemId: refundItems.orderItemId,
                quantity: refundItems.quantity,
            })
            .from(refundItems)
            .innerJoin(refunds, eq(refunds.id, refundItems.refundId))
            .where(and(
                eq(refunds.orderId, orderData.id),
                or(eq(refunds.status, "APPROVED"), eq(refunds.status, "COMPLETED"))
            ))

        // Aggregate refunded quantities
        const refundedQuantityMap = new Map<number, number>()
        for (const record of refundedItemsData) {
            const current = refundedQuantityMap.get(record.orderItemId) || 0
            refundedQuantityMap.set(record.orderItemId, current + record.quantity)
        }

        // Merge with items
        const itemsWithRefundStats = items.map(item => ({
            ...item,
            refundedQuantity: refundedQuantityMap.get(item.id) || 0,
            remainingQuantity: item.quantity - (refundedQuantityMap.get(item.id) || 0)
        }))

        return NextResponse.json({
            order: {
                ...orderData,
                organizationName: org?.name || "Unknown",
                branchName: branch?.name || "Unknown",
                createdByUserName: user?.fullName || user?.email || "Unknown",
                items: itemsWithRefundStats,
            }
        })

    } catch (error: any) {
        console.error("[Refunds Search] Error:", error)
        console.error("[Refunds Search] Error message:", error?.message)
        console.error("[Refunds Search] Error stack:", error?.stack)
        return NextResponse.json({ error: "Internal server error", details: error?.message }, { status: 500 })
    }
}

/**
 * POST /api/v1/admin/refunds
 * Process an item-level refund (Super Admin only)
 * 
 * Body: { orderId: number, items: Array<{itemId: number, quantity: number}>, reason?: string }
 */
export async function POST(req: NextRequest) {
    console.log("[Refunds API] POST endpoint called")
    try {
        // Auth check
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userRole = (session.user as any).role
        const userId = (session.user as any).id as string

        if (userRole !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
        }

        // Parse request body
        let body
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
        }

        const { orderId, items, reason } = body as {
            orderId: number
            items: Array<{ itemId: number; quantity: number }>
            reason?: string
        }

        // ===== INPUT VALIDATION =====

        // Validate orderId
        if (!orderId || !Number.isFinite(orderId) || orderId <= 0) {
            return NextResponse.json({ error: "Valid order ID is required" }, { status: 400 })
        }

        // Validate items array
        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "At least one item must be selected for refund" }, { status: 400 })
        }

        // Validate each item
        for (const item of items) {
            if (!item.itemId || !Number.isFinite(item.itemId) || item.itemId <= 0) {
                return NextResponse.json({ error: "Invalid item ID in refund items" }, { status: 400 })
            }
            if (!item.quantity || !Number.isFinite(item.quantity) || item.quantity <= 0) {
                return NextResponse.json({ error: "Refund quantity must be positive" }, { status: 400 })
            }
        }

        // Validate reason
        if (reason !== undefined && reason !== null) {
            if (typeof reason !== "string") {
                return NextResponse.json({ error: "Reason must be a string" }, { status: 400 })
            }
            if (reason.trim().length > 500) {
                return NextResponse.json({ error: "Reason must not exceed 500 characters" }, { status: 400 })
            }
        }

        // ===== FETCH ORDER =====
        const [orderData] = await db
            .select({
                id: orders.id,
                tid: orders.tid,
                organizationId: orders.organizationId,
                branchId: orders.branchId,
                status: orders.status,
                totalCents: orders.totalCents,
                subtotalCents: orders.subtotalCents,
                taxCents: orders.taxCents,
                statusAtRefund: orders.statusAtRefund,
                refundedAt: orders.refundedAt,
                refundAmountCents: orders.refundAmountCents,
                refundReason: orders.refundReason,
                createdAt: orders.createdAt,
            })
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1)

        if (!orderData) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        // ===== STATUS VALIDATION =====
        const currentStatus = String(orderData.status || "").toUpperCase()

        if (currentStatus === "PENDING") {
            return NextResponse.json({
                error: "Cannot refund pending orders. Order must be approved first."
            }, { status: 400 })
        }

        if (currentStatus === "REJECTED") {
            return NextResponse.json({
                error: "Cannot refund rejected orders."
            }, { status: 400 })
        }

        if (currentStatus === "REFUNDED") {
            return NextResponse.json({
                error: "Order has already been fully refunded."
            }, { status: 400 })
        }

        // ===== VALIDATE REFUND PERIOD (SAME MONTH ONLY) =====
        const orderDate = new Date(orderData.createdAt || new Date())
        const now = new Date()
        const isSameMonth = orderDate.getMonth() === now.getMonth()
        const isSameYear = orderDate.getFullYear() === now.getFullYear()

        if (!isSameMonth || !isSameYear) {
            const orderMonthName = orderDate.toLocaleString('default', { month: 'long', year: 'numeric' })
            return NextResponse.json({
                error: `Refunds are only allowed for orders in the current month. This order is from ${orderMonthName}.`
            }, { status: 403 })
        }

        // ===== FETCH ORDER ITEMS & VALIDATE QUANTITIES =====
        const orderItemsData = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, orderId))

        if (orderItemsData.length === 0) {
            return NextResponse.json({ error: "No items found for this order" }, { status: 404 })
        }

        // Create a map for quick lookup
        const orderItemsMap = new Map(orderItemsData.map(item => [item.id, item]))

        // Fetch already refunded items to calculate remaining quantity
        const refundedItemsData = await db
            .select({
                orderItemId: refundItems.orderItemId,
                quantity: refundItems.quantity,
            })
            .from(refundItems)
            .innerJoin(refunds, eq(refunds.id, refundItems.refundId))
            .where(and(
                eq(refunds.orderId, orderId),
                or(eq(refunds.status, "APPROVED"), eq(refunds.status, "COMPLETED"))
            ))

        const refundedQuantityMap = new Map<number, number>()
        for (const record of refundedItemsData) {
            const current = refundedQuantityMap.get(record.orderItemId) || 0
            refundedQuantityMap.set(record.orderItemId, current + record.quantity)
        }

        let totalRefundAmount = 0
        const refundDetails: Array<{
            itemId: number
            productName: string
            quantity: number
            priceCents: number
            totalCents: number
        }> = []

        // Validate each refund item and calculate total
        for (const refundItem of items) {
            const orderItem = orderItemsMap.get(refundItem.itemId)

            if (!orderItem) {
                return NextResponse.json({
                    error: `Item ID ${refundItem.itemId} not found in this order`
                }, { status: 400 })
            }

            const alreadyRefundedQty = refundedQuantityMap.get(refundItem.itemId) || 0
            const remainingQty = orderItem.quantity - alreadyRefundedQty

            // Validate quantity doesn't exceed remaining amount
            if (refundItem.quantity > remainingQty) {
                return NextResponse.json({
                    error: `Refund quantity (${refundItem.quantity}) exceeds remaining quantity (${remainingQty}) for item: ${orderItem.productName}`
                }, { status: 400 })
            }

            const itemTotal = orderItem.priceCents * refundItem.quantity
            totalRefundAmount += itemTotal

            refundDetails.push({
                itemId: refundItem.itemId,
                productName: orderItem.productName,
                quantity: refundItem.quantity,
                priceCents: orderItem.priceCents,
                totalCents: itemTotal
            })
        }

        // ===== VALIDATE REFUND AMOUNT =====
        const orderTotal = orderData.totalCents || 0
        const alreadyRefunded = orderData.refundAmountCents || 0
        const remainingRefundable = orderTotal - alreadyRefunded

        if (totalRefundAmount > remainingRefundable) {
            return NextResponse.json({
                error: `Total refund amount (PKR ${(totalRefundAmount / 100).toFixed(2)}) exceeds remaining refundable amount (PKR ${(remainingRefundable / 100).toFixed(2)}).`
            }, { status: 400 })
        }

        // ===== PROCESS REFUND IN TRANSACTION =====
        await db.transaction(async (tx) => {
            const newRefundTotal = alreadyRefunded + totalRefundAmount
            const isFullRefund = newRefundTotal >= orderTotal

            // 1. Update order with refund info (DON'T change status to REFUNDED)
            await tx
                .update(orders)
                .set({
                    // Keep original status - track refunds in separate fields
                    statusAtRefund: currentStatus,
                    refundedAt: new Date(),
                    refundedByUserId: userId,
                    refundAmountCents: newRefundTotal,
                    refundReason: reason?.trim() || orderData.refundReason,
                    updatedAt: new Date(),
                })
                .where(eq(orders.id, orderId))

            // 2. Credit branch budget (add back the refunded amount)
            // Must match the current month's budget period
            const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
            const [budget] = await tx
                .select()
                .from(budgets)
                .where(and(
                    eq(budgets.branchId, orderData.branchId),
                    eq(budgets.period, currentMonth)
                ))
                .limit(1)

            if (budget) {
                // Credit by reducing the spent amount AND incrementing credited amount
                const currentSpent = budget.amountSpentCents || 0
                const newSpentAmount = Math.max(0, currentSpent - totalRefundAmount)

                await tx
                    .update(budgets)
                    .set({
                        amountSpentCents: newSpentAmount,
                        amountCreditedCents: sql`${budgets.amountCreditedCents} + ${totalRefundAmount}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(budgets.id, budget.id))

                console.log(`[Refunds] Budget updated: ${totalRefundAmount} cents credited back. Spent: ${currentSpent} -> ${newSpentAmount}, branch ${orderData.branchId}, period ${currentMonth}`)
            } else {
                console.warn(`[Refunds] No budget found for branch ${orderData.branchId}, period ${currentMonth}. Refund credit skipped.`)
            }

            // 3. Create audit log
            await tx.insert(auditLogs).values({
                userId,
                action: "REFUND_PROCESSED",
                entity: "Order",
                entityId: String(orderId),
                organizationId: orderData.organizationId,
                branchId: orderData.branchId,
                metadata: {
                    tid: orderData.tid,
                    previousStatus: currentStatus,
                    statusPreserved: currentStatus,
                    refundItems: refundDetails,
                    totalRefundAmountCents: totalRefundAmount,
                    totalRefundAmountPKR: (totalRefundAmount / 100).toFixed(2),
                    totalRefunded: newRefundTotal,
                    isFullRefund,
                    reason: reason?.trim() || "No reason provided",
                },
            })

            // 4. Create refund record
            const [newRefund] = await tx.insert(refunds).values({
                organizationId: orderData.organizationId,
                orderId,
                amountCents: totalRefundAmount,
                reason: reason?.trim() || null,
                status: "APPROVED",
                processedByUserId: userId,
            }).returning({ id: refunds.id })

            // 5. Insert refund items
            if (newRefund && refundDetails.length > 0) {
                await tx.insert(refundItems).values(
                    refundDetails.map(item => ({
                        refundId: newRefund.id,
                        orderItemId: item.itemId,
                        quantity: item.quantity,
                        amountCents: item.totalCents
                    }))
                )
            }
        })

        return NextResponse.json({
            message: `Refund of PKR ${(totalRefundAmount / 100).toFixed(2)} processed successfully`,
            refundAmount: (totalRefundAmount / 100).toFixed(2),
            itemsRefunded: refundDetails.length,
            totalRefunded: ((alreadyRefunded + totalRefundAmount) / 100).toFixed(2),
            orderTotal: (orderTotal / 100).toFixed(2),
        })

    } catch (error: any) {
        console.error("[Refunds Process] Error:", error)
        console.error("[Refunds Process] Error message:", error?.message)
        console.error("[Refunds Process] Error code:", error?.code)
        console.error("[Refunds Process] Stack:", error?.stack)

        // Handle specific database errors
        if (error.code === "23503") {
            return NextResponse.json({ error: "Referenced order or user not found" }, { status: 404 })
        }

        return NextResponse.json({
            error: "Internal server error while processing refund",
            details: error?.message || "Unknown error"
        }, { status: 500 })
    }
}
