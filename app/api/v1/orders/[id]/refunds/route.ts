import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { refunds, orders, budgets, auditLogs, users } from "@/db/schema"
import { eq, sql, desc } from "drizzle-orm"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const orderId = parseInt(id)
    if (!Number.isFinite(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })

    // Get order details first to check permissions
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const userRole = (session.user as any).role
    const userOrgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId

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

    return NextResponse.json({ refunds: refundsData })
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

    const { amountCents, reason } = body as { amountCents: number, reason?: string }

    // Validate refund amount
    if (amountCents === undefined || amountCents === null) {
      return NextResponse.json({ error: 'Refund amount is required' }, { status: 400 })
    }

    if (!Number.isFinite(amountCents)) {
      return NextResponse.json({ error: 'Refund amount must be a valid number' }, { status: 400 })
    }

    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Refund amount must be positive' }, { status: 400 })
    }

    // Safety check for extremely large values
    if (amountCents > Number.MAX_SAFE_INTEGER / 2) {
      return NextResponse.json({ error: 'Refund amount exceeds maximum allowed value' }, { status: 400 })
    }

    // Validate reason if provided
    if (reason !== undefined && reason !== null) {
      if (typeof reason !== 'string') {
        return NextResponse.json({ error: 'Reason must be a string' }, { status: 400 })
      }
      if (reason.trim().length > 500) {
        return NextResponse.json({ error: 'Reason must not exceed 500 characters' }, { status: 400 })
      }
    }

    // Fetch order with validation
    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)

    if (!ord) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const orderData = ord as any

    // Validate order status - cannot refund pending or already refunded orders
    const orderStatus = String(orderData.status || '').toUpperCase()
    if (orderStatus === 'PENDING') {
      return NextResponse.json({
        error: 'Cannot refund pending orders. Order must be approved or fulfilled first.'
      }, { status: 400 })
    }

    if (orderStatus === 'REFUNDED') {
      return NextResponse.json({
        error: 'Order has already been fully refunded'
      }, { status: 400 })
    }

    // Validate refund amount doesn't exceed order total
    const orderTotal = orderData.totalCents || 0
    if (amountCents > orderTotal) {
      return NextResponse.json({
        error: `Refund amount (${(amountCents / 100).toFixed(2)} PKR) cannot exceed order total (${(orderTotal / 100).toFixed(2)} PKR)`
      }, { status: 400 })
    }

    // Check for existing refunds to prevent over-refunding
    const existingRefunds = await db
      .select({ amountCents: refunds.amountCents })
      .from(refunds)
      .where(eq(refunds.orderId, orderId))

    const totalRefunded = existingRefunds.reduce((sum, r) => sum + (r.amountCents || 0), 0)
    const remainingRefundable = orderTotal - totalRefunded

    if (amountCents > remainingRefundable) {
      return NextResponse.json({
        error: `Refund amount (${(amountCents / 100).toFixed(2)} PKR) exceeds remaining refundable amount (${(remainingRefundable / 100).toFixed(2)} PKR). Already refunded: ${(totalRefunded / 100).toFixed(2)} PKR`
      }, { status: 400 })
    }

    const userRole = (session.user as any).role
    const userId = (session.user as any).id as string
    const userOrgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId

    // Verify user has permission for this order
    if (userRole === "BRANCH_ADMIN" && orderData.branchId !== userBranchId) {
      return NextResponse.json({ error: "Forbidden: Cannot refund orders from other branches" }, { status: 403 })
    }

    if (userRole === "HEAD_OFFICE" && orderData.organizationId !== userOrgId) {
      return NextResponse.json({ error: "Forbidden: Cannot refund orders from other organizations" }, { status: 403 })
    }

    // Execute refund in transaction
    await db.transaction(async (tx) => {
      if (userRole === "SUPER_ADMIN") {
        // Super Admin: approve/process refund and adjust budgets
        await tx.insert(refunds).values({
          organizationId: orderData.organizationId,
          orderId,
          amountCents,
          reason: reason?.trim() || null,
          status: "APPROVED",
          processedByUserId: userId,
        })

        // Adjust budget - credit back the refunded amount
        const currentPeriod = new Date().toISOString().slice(0, 7) // YYYY-MM
        const [budget] = await tx
          .select()
          .from(budgets)
          .where(eq(budgets.branchId, orderData.branchId))
          .limit(1)

        if (budget) {
          // Validate budget won't go negative
          const newSpentAmount = (budget.amountSpentCents || 0) - amountCents
          if (newSpentAmount < 0) {
            console.warn(`[Refunds] Budget spent would go negative for branch ${orderData.branchId}: ${newSpentAmount}`)
          }

          await tx
            .update(budgets)
            .set({
              amountSpentCents: sql`${budgets.amountSpentCents} - ${amountCents}`,
              amountCreditedCents: sql`${budgets.amountCreditedCents} + ${amountCents}`,
              updatedAt: new Date(),
            })
            .where(eq(budgets.id, budget.id))
        }

        // If full refund (or total refunded equals order total), mark order as refunded
        const newTotalRefunded = totalRefunded + amountCents
        if (newTotalRefunded >= orderTotal) {
          await tx
            .update(orders)
            .set({
              status: "refunded",
              updatedAt: new Date()
            })
            .where(eq(orders.id, orderId))
        }

        // Audit log
        await tx.insert(auditLogs).values({
          userId,
          action: "REFUND_APPROVED",
          entity: "Order",
          entityId: String(orderId),
          organizationId: orderData.organizationId,
          branchId: orderData.branchId,
          metadata: {
            tid: orderData.tid,
            amountCents,
            amountPKR: (amountCents / 100).toFixed(2),
            reason: reason?.trim() || 'No reason provided',
            previouslyRefunded: totalRefunded,
            newTotalRefunded
          },
        })
      } else {
        // Branch Admin / Head Office: create refund REQUEST only (no budget changes)
        await tx.insert(refunds).values({
          organizationId: orderData.organizationId,
          orderId,
          amountCents,
          reason: reason?.trim() || null,
          status: "PENDING",
          requestedByUserId: userId,
        })

        // Audit log
        await tx.insert(auditLogs).values({
          userId,
          action: "REFUND_REQUESTED",
          entity: "Order",
          entityId: String(orderId),
          organizationId: orderData.organizationId,
          branchId: orderData.branchId,
          metadata: {
            tid: orderData.tid,
            amountCents,
            amountPKR: (amountCents / 100).toFixed(2),
            reason: reason?.trim() || 'No reason provided'
          },
        })
      }
    })

    return NextResponse.json({
      message: userRole === "SUPER_ADMIN"
        ? `Refund of ${(amountCents / 100).toFixed(2)} PKR processed successfully`
        : `Refund request of ${(amountCents / 100).toFixed(2)} PKR submitted successfully`,
      refundAmount: (amountCents / 100).toFixed(2),
      remainingRefundable: ((remainingRefundable - amountCents) / 100).toFixed(2)
    })
  } catch (e: any) {
    console.error('[Refunds] Error processing refund:', e)

    // Handle specific database errors
    if (e.code === '23503') {
      return NextResponse.json({ error: 'Referenced order or user not found' }, { status: 404 })
    }

    return NextResponse.json({
      error: e.message || 'Internal server error while processing refund'
    }, { status: 500 })
  }
}


