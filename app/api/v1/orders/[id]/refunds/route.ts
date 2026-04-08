import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { refunds, orders, budgets, auditLogs, users, orderItems, refundItems } from "@/db/schema"
import { eq, sql, desc, inArray, and } from "drizzle-orm"

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
    if (isNaN(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })

    const userRole = (session.user as any).role
    const runner = userRole === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(session.user as any, cb)

    const result = await runner(async (tx: any) => {
      // Get order details first — withTenant filters by org unless super_admin
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
      if (!order) throw new Error("Order not found or access denied")

      // Fetch refunds with user details
      const refundsData = await tx
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
      let refundsWithItems = refundsData.map((r: any) => ({ ...r, items: [] as any[] }))

      if (refundsData.length > 0) {
        const refundIds = refundsData.map((r: any) => r.id)
        const items = await tx
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
        const itemsMap = new Map<number, any>()
        items.forEach((item: any) => {
          if (!itemsMap.has(item.refundId)) itemsMap.set(item.refundId, [])
          itemsMap.get(item.refundId)?.push(item)
        })

        refundsWithItems = refundsData.map((r: any) => ({
          ...r,
          items: itemsMap.get(r.id) || []
        }))
      }

      return refundsWithItems
    })

    return NextResponse.json({ refunds: result })
  } catch (error: any) {
    console.error("Error fetching refunds:", error)
    const status = error.message.includes("not found") || error.message.includes("denied") ? 404 : 500
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const params = await props.params
    const { id } = params
    const orderId = parseInt(id, 10)
    if (isNaN(orderId) || orderId <= 0) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const { items, reason } = body as { items: { id: number, quantity: number }[], reason?: string }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'List of items to refund is required' }, { status: 400 })
    }

    const userRole = (session.user as any).role
    const userId = (session.user as any).id as string
    const runner = userRole === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(session.user as any, cb)

    const result = await runner(async (tx: any) => {
      // Fetch order with validation (filtered by withTenant if not super_admin)
      const [ord] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
      if (!ord) throw new Error('Order not found or access denied')

      const orderData = ord as any
      const orderStatus = String(orderData.status || '').toUpperCase()

      if (orderStatus === 'REFUNDED') throw new Error('Order has already been fully refunded')

      const orderDate = new Date(orderData.createdAt)
      const now = new Date()
      if (orderDate.getMonth() !== now.getMonth() || orderDate.getFullYear() !== now.getFullYear()) {
        throw new Error('Refund period ended. Refunds are only allowed within the calendar month of the order.')
      }

      // 1. Fetch original order items
      const orderItemsList = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
      const orderItemsMap = new Map((orderItemsList as any[]).map(i => [i.id, i]))

      // Check previously refunded quantities
      const previousRefunds = await tx
        .select({
          orderItemId: refundItems.orderItemId,
          quantity: refundItems.quantity,
          status: refunds.status
        })
        .from(refundItems)
        .innerJoin(refunds, eq(refundItems.refundId, refunds.id))
        .where(eq(refunds.orderId, orderId))

      const approvedRefundedMap = new Map<number, number>()
      const pendingRefundedMap = new Map<number, number>()

      for (const p of (previousRefunds as any[])) {
        if (p.status === 'APPROVED' || p.status === 'COMPLETED') {
          approvedRefundedMap.set(p.orderItemId, (approvedRefundedMap.get(p.orderItemId) || 0) + p.quantity)
        } else if (p.status === 'PENDING') {
          pendingRefundedMap.set(p.orderItemId, (pendingRefundedMap.get(p.orderItemId) || 0) + p.quantity)
        }
      }

      // 2. Calculate refund amount
      let totalRefundAmount = 0
      const refundDetails: any[] = []

      for (const item of items) {
        const originalItem = orderItemsMap.get(item.id)
        if (!originalItem) throw new Error(`Item ${item.id} does not belong to this order`)
        if (item.quantity <= 0) throw new Error(`Invalid quantity for item ${originalItem.productName}`)

        const approvedRefunded = approvedRefundedMap.get(item.id) || 0
        const pendingRefunded = pendingRefundedMap.get(item.id) || 0
        const remainingQty = originalItem.quantity - (approvedRefunded + pendingRefunded)

        if (item.quantity > remainingQty) {
          throw new Error(`Cannot refund ${item.quantity} of ${originalItem.productName}. Only ${remainingQty} remaining.`)
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

      // 3. Final safety checks
      const existingRefundsResult = await tx
        .select({ amountCents: refunds.amountCents, status: refunds.status })
        .from(refunds)
        .where(eq(refunds.orderId, orderId))

      const approvedTotal = (existingRefundsResult as any[])
        .filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED')
        .reduce((sum, r) => sum + (r.amountCents || 0), 0)

      const pendingTotal = (existingRefundsResult as any[])
        .filter(r => r.status === 'PENDING')
        .reduce((sum, r) => sum + (r.amountCents || 0), 0)

      const remainingRefundableAmount = orderData.totalCents - (approvedTotal + pendingTotal)

      if (totalRefundAmount > remainingRefundableAmount) {
        throw new Error(`Refund amount exceeds remaining refundable capacity.`)
      }

      let refundId: number;
      const isFullRefund = (approvedTotal + (userRole === "SUPER_ADMIN" ? totalRefundAmount : 0)) >= orderData.totalCents
      
      if (userRole === "SUPER_ADMIN") {
        const [insertedRefund] = await tx.insert(refunds).values({
          organizationId: orderData.organizationId,
          orderId,
          amountCents: totalRefundAmount,
          reason: reason?.trim() || null,
          status: "APPROVED",
          processedByUserId: userId,
        }).returning({ id: refunds.id })

        refundId = insertedRefund.id;

        const currentMonth = new Date().toISOString().slice(0, 7)
        const [budget] = await tx.select().from(budgets).where(and(eq(budgets.branchId, orderData.branchId), eq(budgets.period, currentMonth))).limit(1)

        if (budget) {
          const isFulfilled = orderStatus === "FULFILLED"
          await tx.update(budgets).set(
            isFulfilled 
              ? { amountSpentCents: sql`GREATEST(0, ${budgets.amountSpentCents} - ${totalRefundAmount})` }
              : { amountHeldCents: sql`GREATEST(0, ${budgets.amountHeldCents} - ${totalRefundAmount})` }
          ).where(eq(budgets.id, budget.id))
        }

        await tx.update(orders).set({
          refundAmountCents: sql`COALESCE(${orders.refundAmountCents}, 0) + ${totalRefundAmount}`,
          statusAtRefund: orderStatus,
          refundedAt: new Date(),
          refundedByUserId: userId,
          status: isFullRefund ? "REFUNDED" : orderStatus,
          updatedAt: new Date()
        }).where(eq(orders.id, orderId))

        await tx.insert(auditLogs).values({
          userId,
          action: "REFUND_APPROVED",
          entity: "Order",
          entityId: String(orderId),
          organizationId: orderData.organizationId,
          branchId: orderData.branchId,
          metadata: { tid: orderData.tid, amountCents: totalRefundAmount, items: refundDetails },
        })
      } else {
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
          metadata: { tid: orderData.tid, amountCents: totalRefundAmount, items: refundDetails },
        })
      }

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

      return { totalRefundAmount, remainingRefundableAmount }
    })

    return NextResponse.json({
      message: userRole === "SUPER_ADMIN"
        ? `Refund of ${((result as any).totalRefundAmount / 100).toFixed(2)} PKR processed successfully`
        : `Refund request of ${((result as any).totalRefundAmount / 100).toFixed(2)} PKR submitted successfully`,
      refundAmount: ((result as any).totalRefundAmount / 100).toFixed(2),
      remainingRefundable: (((result as any).remainingRefundableAmount - (result as any).totalRefundAmount) / 100).toFixed(2)
    })

  } catch (e: any) {
    console.error('[Refunds] Error processing refund:', e)
    const status = e.message.includes('not found') || e.message.includes('denied') ? 404 : 400
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: e.message.includes('Internal') ? 500 : status })
  }
}
