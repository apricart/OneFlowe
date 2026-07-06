import { error, ok, readJson, requireApiRole } from "@/lib/api"
import { getCurrentUser, verifyResourceAccess } from "@/lib/auth"
import { db } from "@/lib/db"
import { auditLogs, orders } from "@/db/schema"
import { PAYMENT_STATUSES, normalizePaymentStatus } from "@/lib/payment-status"
import { orderSelectColumns, updateOrderPaymentStatusColumn } from "@/lib/order-select"
import { eq } from "drizzle-orm"

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const roleError = await requireApiRole(["SUPER_ADMIN"])
  if (roleError) return roleError

  const user = await getCurrentUser()
  if (!user) return error("Unauthorized", 401)

  const params = await props.params
  const orderId = Number(params.id)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return error("Invalid order ID", 400)
  }

  const body = await readJson<{ paymentStatus?: string }>(req)
  const rawStatus = String(body?.paymentStatus || "").trim().toUpperCase()
  if (!PAYMENT_STATUSES.includes(rawStatus as (typeof PAYMENT_STATUSES)[number])) {
    return error("Invalid payment status. Must be PAID or UNPAID.", 400)
  }
  const nextStatus = normalizePaymentStatus(rawStatus)

  const [order] = await db.select(orderSelectColumns).from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return error("Order not found", 404)

  const hasAccess = await verifyResourceAccess(order.organizationId, order.branchId)
  if (!hasAccess) return error("Forbidden: You do not have access to this order", 403)

  const currentStatus = normalizePaymentStatus(order.paymentStatus)
  if (currentStatus === nextStatus) {
    return error(`Order is already marked ${nextStatus}`, 400)
  }

  const updated = await db.transaction(async (tx) => {
    const migrationReady = await updateOrderPaymentStatusColumn(tx, orderId, nextStatus, user.id)
    if (!migrationReady) return null

    await tx.insert(auditLogs).values({
      userId: user.id,
      organizationId: order.organizationId,
      branchId: order.branchId,
      action: "ORDER_PAYMENT_STATUS_UPDATE",
      entity: "Order",
      entityId: String(order.id),
      metadata: {
        tid: order.tid,
        from: currentStatus,
        to: nextStatus,
      },
    })

    return { ...order, paymentStatus: nextStatus }
  })

  if (!updated) {
    return error("Payment status migration has not been applied. Run the order payment status migration first.", 503)
  }

  return ok({
    message: `Order marked ${nextStatus === "PAID" ? "Paid" : "Unpaid"}`,
    item: updated,
  })
}
