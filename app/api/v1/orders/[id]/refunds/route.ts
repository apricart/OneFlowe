import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { refunds, orders, budgets, auditLogs, users, orderItems, refundItems } from "@/db/schema"
import { eq, sql, desc, inArray, and } from "drizzle-orm"
import { shouldHidePricesForRole } from "@/lib/price-visibility"
import { releaseRefundedQuantityBudget } from "@/lib/server/product-quantity-budget-ledger"

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const params = await props.params
    const { id } = params
    const orderId = parseInt(id)
    if (!Number.isFinite(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })

    // Get order details first to check permissions
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const userRole = (session.user as any).role
    const userOrgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId
    if (await shouldHidePricesForRole(userRole, order.organizationId)) {
      return NextResponse.json({ error: "Refund details are unavailable while prices are hidden" }, { status: 403 })
    }

    // Check permissions
    if (userRole === "BRANCH_ADMIN" && (order as any).branchId !== userBranchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (userRole === "HEAD_OFFICE" && (order as any).organizationId !== userOrgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch refunds with user details
    const refundsData = await db
      .select({
        id: refunds.id,
        amountCents: refunds.amountCents,
        reason: refunds.reason,
        createdAt: refunds.createdAt,
        status: refunds.status,
        requestedByUserId: refunds.requestedByUserId,
        processedByUserId: refunds.processedByUserId,
        processedByUser: {
          email: users.email,
          fullName: users.fullName,
        }
      })
      .from(refunds)
      .leftJoin(users, eq(refunds.processedByUserId, users.id))
      .where(eq(refunds.orderId, orderId))
      .orderBy(desc(refunds.createdAt))

    // Fetch refund items if any refunds exist
    let refundsWithItems = refundsData.map(r => ({ ...r, items: [] as any[] }))

    if (refundsData.length > 0) {
      const refundIds = refundsData.map(r => r.id)
      const items = await db
        .select({
          refundId: refundItems.refundId,
          orderItemId: refundItems.orderItemId,
          quantity: refundItems.quantity,
          amountCents: refundItems.amountCents,
          productName: orderItems.productName,
          unit: orderItems.unit
        })
        .from(refundItems)
        .innerJoin(orderItems, eq(refundItems.orderItemId, orderItems.id))
        .where(inArray(refundItems.refundId, refundIds))

      // Attach items to refunds
      const itemsMap = new Map<number, typeof items>()
      items.forEach(item => {
        if (!itemsMap.has(item.refundId)) itemsMap.set(item.refundId, [])
        itemsMap.get(item.refundId)?.push(item)
      })

      refundsWithItems = refundsData.map(r => ({
        ...r,
        items: itemsMap.get(r.id) || []
      }))
    }

    return NextResponse.json({ refunds: refundsWithItems })
  } catch (error: any) {
    console.error("Error fetching refunds:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Validate order ID
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Invalid order ID format" }, { status: 400 })
    }

    const orderId = parseInt(id, 10)
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })
    }

    let body
    try {
      body = await req.json()
    } catch (jsonError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { items, reason } = body as { items: { id: number, quantity: number }[], reason?: string }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'List of items to refund is required' }, { status: 400 })
    }

    // Fetch order with validation
    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)

    if (!ord) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const orderData = ord as any

    // Validate order status
    const orderStatus = String(orderData.status || '').toUpperCase()

    if (orderStatus === 'REFUNDED') {
      return NextResponse.json({
        error: 'Order has already been fully refunded'
      }, { status: 400 })
    }

    // Validate refund window (must be same month/year)
    const orderDate = new Date(orderData.createdAt)
    const now = new Date()
    if (orderDate.getMonth() !== now.getMonth() || orderDate.getFullYear() !== now.getFullYear()) {
      return NextResponse.json({
        error: 'Refund period ended. Refunds are only allowed within the calendar month of the order.'
      }, { status: 400 })
    }

    const userRole = (session.user as any).role
    const userId = (session.user as any).id as string
    const userOrgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId
    if (await shouldHidePricesForRole(userRole, orderData.organizationId)) {
      return NextResponse.json({ error: "Refund requests are unavailable while prices are hidden" }, { status: 403 })
    }

    // Verify user has permission for this order
    if (userRole === "BRANCH_ADMIN" && orderData.branchId !== userBranchId) {
      return NextResponse.json({ error: "Forbidden: Cannot refund orders from other branches" }, { status: 403 })
    }

    if (userRole === "HEAD_OFFICE" && orderData.organizationId !== userOrgId) {
      return NextResponse.json({ error: "Forbidden: Cannot refund orders from other organizations" }, { status: 403 })
    }

    // 1. Fetch original order items to validate prices and quantities
    const orderItemsList = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    const orderItemsMap = new Map(orderItemsList.map(i => [i.id, i]))

    // Check previously refunded quantities
    // We need to fetch all refund_items associated with refunds for this order
    // But since we can query refund_items directly joined with refund...
    const previousRefunds = await db
      .select({
        orderItemId: refundItems.orderItemId,
        quantity: refundItems.quantity,
        status: refunds.status
      })
      .from(refundItems)
      .innerJoin(refunds, eq(refundItems.refundId, refunds.id))
      .where(eq(refunds.orderId, orderId))

    // Aggregate previously refunded quantities per item
    const approvedRefundedMap = new Map<number, number>()
    const pendingRefundedMap = new Map<number, number>()

    for (const p of previousRefunds) {
      if (p.status === 'APPROVED' || p.status === 'COMPLETED') {
        approvedRefundedMap.set(p.orderItemId, (approvedRefundedMap.get(p.orderItemId) || 0) + p.quantity)
      } else if (p.status === 'PENDING') {
        pendingRefundedMap.set(p.orderItemId, (pendingRefundedMap.get(p.orderItemId) || 0) + p.quantity)
      }
    }

    // 2. Calculate refund amount from server-side data
    let totalRefundAmount = 0
    const refundDetails: { orderItemId: number, name: string, quantity: number, amount: number }[] = []

    for (const item of items) {
      const originalItem = orderItemsMap.get(item.id)
      if (!originalItem) {
        return NextResponse.json({ error: `Item ${item.id} does not belong to this order` }, { status: 400 })
      }

      if (item.quantity <= 0) {
        return NextResponse.json({ error: `Invalid quantity for item ${originalItem.productName}` }, { status: 400 })
      }

      const approvedRefunded = approvedRefundedMap.get(item.id) || 0
      const pendingRefunded = pendingRefundedMap.get(item.id) || 0
      const remainingQty = originalItem.quantity - (approvedRefunded + pendingRefunded)

      if (item.quantity > remainingQty) {
        return NextResponse.json({
          error: `Cannot refund ${item.quantity} of ${originalItem.productName}. Only ${remainingQty} remaining (Ordered: ${originalItem.quantity}, Approved: ${approvedRefunded}, Pending: ${pendingRefunded})`
        }, { status: 400 })
      }

      const itemTotal = originalItem.priceCents * item.quantity
      totalRefundAmount += itemTotal

      refundDetails.push({
        orderItemId: item.id,
        name: originalItem.productName,
        quantity: item.quantity,
        amount: itemTotal
      })
    }

    // Check for existing refunds to prevent over-refunding (amount check as safety net)
    const existingRefunds = await db
      .select({ amountCents: refunds.amountCents, status: refunds.status })
      .from(refunds)
      .where(eq(refunds.orderId, orderId))

    const approvedTotal = existingRefunds
      .filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED')
      .reduce((sum, r) => sum + (r.amountCents || 0), 0)

    const pendingTotal = existingRefunds
      .filter(r => r.status === 'PENDING')
      .reduce((sum, r) => sum + (r.amountCents || 0), 0)

    const remainingRefundableAmount = orderData.totalCents - (approvedTotal + pendingTotal)

    if (totalRefundAmount > remainingRefundableAmount) {
      return NextResponse.json({
        error: `Refund amount (${(totalRefundAmount / 100).toFixed(2)} PKR) exceeds remaining refundable capacity (Total: ${(orderData.totalCents / 100).toFixed(2)}, Approved: ${(approvedTotal / 100).toFixed(2)}, Pending: ${(pendingTotal / 100).toFixed(2)}).`
      }, { status: 400 })
    }

    // Execute refund in transaction
    await db.transaction(async (tx) => {
      let refundId: number;

      // Check if this is a full refund
      const newApprovedTotal = approvedTotal + (userRole === "SUPER_ADMIN" ? totalRefundAmount : 0)
      const isFullRefund = newApprovedTotal >= orderData.totalCents
      const refundType = isFullRefund ? "FULL" : "PARTIAL"

      if (userRole === "SUPER_ADMIN") {
        // Super Admin: approve/process refund and adjust budgets
        const [insertedRefund] = await tx.insert(refunds).values({
          organizationId: orderData.organizationId,
          orderId,
          amountCents: totalRefundAmount,
          reason: reason?.trim() || null,
          status: "APPROVED",
          processedByUserId: userId,
        }).returning({ id: refunds.id })

        refundId = insertedRefund.id;

        // Adjust budget - credit back the refunded amount
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
        const [budget] = await tx
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.branchId, orderData.branchId),
              eq(budgets.period, currentMonth)
            )
          )
          .limit(1)

        if (budget) {
          // Determine which bucket the order money was in:
          // FULFILLED → amountSpentCents; APPROVED/PENDING → amountHeldCents
          // We NEVER touch amountCreditedCents (addon) on a refund — that field
          // is exclusively for manual Head-Office add-on credits.
          const isFulfilled = orderStatus === "FULFILLED"
          await tx
            .update(budgets)
            .set(
              isFulfilled
                ? {
                    // Money was already moved to spent; give it back
                    amountSpentCents: sql`GREATEST(0, ${budgets.amountSpentCents} - ${totalRefundAmount})`,
                    updatedAt: new Date(),
                  }
                : {
                    // Money was still on hold; release the held amount
                    amountHeldCents: sql`GREATEST(0, ${budgets.amountHeldCents} - ${totalRefundAmount})`,
                    updatedAt: new Date(),
                  }
            )
            .where(eq(budgets.id, budget.id))
        }

        await releaseRefundedQuantityBudget(
          tx,
          orderData,
          refundDetails.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        )

        // Update order refund amount and preserve original status
        await tx
          .update(orders)
          .set({
            refundAmountCents: sql`COALESCE(${orders.refundAmountCents}, 0) + ${totalRefundAmount}`,
            statusAtRefund: orderStatus, // Preserve original order status
            refundedAt: new Date(),
            refundedByUserId: userId,
            // Change status to REFUNDED only if this is a full refund
            status: isFullRefund ? "REFUNDED" : orderStatus,
            updatedAt: new Date()
          })
          .where(eq(orders.id, orderId))

        // statusAtRefund preserves what the status was before any refund
        // status will be REFUNDED for full refunds, or remain APPROVED/FULFILLED for partial

        await tx.insert(auditLogs).values({
          userId,
          action: "REFUND_APPROVED",
          entity: "Order",
          entityId: String(orderId),
          organizationId: orderData.organizationId,
          branchId: orderData.branchId,
          metadata: {
            tid: orderData.tid,
            amountCents: totalRefundAmount,
            reason: reason?.trim() || 'Itemized refund',
            items: refundDetails
          },
        })
      } else {
        // Branch Admin / Head Office: create refund REQUEST
        const [insertedRefund] = await tx.insert(refunds).values({
          organizationId: orderData.organizationId,
          orderId,
          amountCents: totalRefundAmount,
          reason: reason?.trim() || null,
          status: "PENDING",
          requestedByUserId: userId,
        }).returning({ id: refunds.id })

        refundId = insertedRefund.id;

        await tx.insert(auditLogs).values({
          userId,
          action: "REFUND_REQUESTED",
          entity: "Order",
          entityId: String(orderId),
          organizationId: orderData.organizationId,
          branchId: orderData.branchId,
          metadata: {
            tid: orderData.tid,
            amountCents: totalRefundAmount,
            reason: reason?.trim() || 'Itemized refund',
            items: refundDetails
          },
        })
      }

      // Insert refund items
      if (refundId && refundDetails.length > 0) {
        await tx.insert(refundItems).values(
          refundDetails.map(item => ({
            refundId,
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            amountCents: item.amount
          }))
        )
      }
    })

    return NextResponse.json({
      message: userRole === "SUPER_ADMIN"
        ? `Refund of ${(totalRefundAmount / 100).toFixed(2)} PKR processed successfully`
        : `Refund request of ${(totalRefundAmount / 100).toFixed(2)} PKR submitted successfully`,
      refundAmount: (totalRefundAmount / 100).toFixed(2),
      remainingRefundable: ((remainingRefundableAmount - totalRefundAmount) / 100).toFixed(2)
    })
  } catch (e: any) {
    console.error('[Refunds] Error processing refund:', e)
    if (e.code === '23503') {
      return NextResponse.json({ error: 'Referenced order or user not found' }, { status: 404 })
    }
    return NextResponse.json({
      error: 'Internal server error while processing refund'
    }, { status: 500 })
  }
}


