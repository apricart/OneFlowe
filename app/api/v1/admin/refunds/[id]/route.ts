import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { refunds, orders, auditLogs } from "@/db/schema"
import { eq, and } from "drizzle-orm"

/**
 * PATCH /api/v1/admin/refunds/[id]
 * Cancel a pending refund request (Super Admin only).
 *
 * A PENDING refund request has not touched order status or budget,
 * so cancelling it only soft-deletes the refund record.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    const userId = (session.user as any).id as string

    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const { id } = await params
    const refundId = parseInt(id, 10)
    if (!Number.isFinite(refundId) || refundId <= 0) {
      return NextResponse.json({ error: "Invalid refund ID" }, { status: 400 })
    }

    let body: { action?: string } = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    if (body.action !== "cancel") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
    }

    // Fetch the refund record
    const [refund] = await db
      .select({
        id: refunds.id,
        status: refunds.status,
        orderId: refunds.orderId,
        organizationId: refunds.organizationId,
        amountCents: refunds.amountCents,
        reason: refunds.reason,
      })
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1)

    if (!refund) {
      return NextResponse.json({ error: "Refund request not found" }, { status: 404 })
    }

    if (refund.status !== "PENDING") {
      return NextResponse.json({
        error: `Cannot cancel a refund that is already ${refund.status.toLowerCase()}`
      }, { status: 400 })
    }

    // Fetch order TID for the audit log
    const [order] = await db
      .select({ tid: orders.tid, branchId: orders.branchId })
      .from(orders)
      .where(eq(orders.id, refund.orderId))
      .limit(1)

    await db.transaction(async (tx) => {
      // Soft-cancel: mark as CANCELLED so audit history is preserved
      await tx
        .update(refunds)
        .set({ status: "CANCELLED", processedByUserId: userId, updatedAt: new Date() })
        .where(and(eq(refunds.id, refundId), eq(refunds.status, "PENDING")))

      await tx.insert(auditLogs).values({
        userId,
        action: "REFUND_CANCELLED",
        entity: "Order",
        entityId: String(refund.orderId),
        organizationId: refund.organizationId,
        branchId: order?.branchId ?? null,
        metadata: {
          refundId,
          tid: order?.tid,
          amountCents: refund.amountCents,
          reason: refund.reason,
        },
      })
    })

    return NextResponse.json({ message: "Refund request cancelled successfully" })
  } catch (error: any) {
    console.error("[Cancel Refund] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
