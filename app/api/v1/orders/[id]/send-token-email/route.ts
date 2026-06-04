import { error, ok, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { auditLogs, branches, orderItems, orders, organizations } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser, verifyResourceAccess } from "@/lib/auth"
import { sendOrderTokenEmail } from "@/lib/email"

const TOKEN_EMAIL_RECIPIENT = process.env.ORDER_TOKEN_ADMIN_EMAIL || "ali_khan87@live.com"

export async function POST(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const roleError = await requireApiRole(["BRANCH_ADMIN"])
  if (roleError) return roleError

  const user = await getCurrentUser()
  if (!user) return error("Unauthorized", 401)

  const params = await props.params
  const orderId = Number(params.id)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return error("Invalid order ID", 400)
  }

  const [order] = await db
    .select({
      id: orders.id,
      tid: orders.tid,
      organizationId: orders.organizationId,
      branchId: orders.branchId,
      status: orders.status,
      approvalToken: orders.approvalToken,
      createdAt: orders.createdAt,
      organizationName: organizations.name,
      branchName: branches.name,
    })
    .from(orders)
    .leftJoin(organizations, eq(orders.organizationId, organizations.id))
    .leftJoin(branches, eq(orders.branchId, branches.id))
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) return error("Order not found", 404)

  const hasAccess = await verifyResourceAccess(order.organizationId, order.branchId)
  if (!hasAccess) return error("Forbidden: You do not have access to this order", 403)

  if (String(order.status || "").toUpperCase() !== "APPROVED") {
    return error("Token email can only be sent for approved orders", 400)
  }

  if (!order.approvalToken) {
    return error("This order does not have a fulfillment token available", 400)
  }

  const items = await db
    .select({
      productName: orderItems.productName,
      productCode: orderItems.productCode,
      quantity: orderItems.quantity,
      unit: orderItems.unit,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))

  const sent = await sendOrderTokenEmail({
    to: TOKEN_EMAIL_RECIPIENT,
    token: order.approvalToken,
    tid: order.tid,
    organizationName: order.organizationName || `Organization ${order.organizationId || ""}`,
    branchName: order.branchName || `Branch ${order.branchId}`,
    status: order.status,
    createdAt: order.createdAt,
    items,
  })

  if (!sent) {
    return error("Failed to send token email through Resend. Please check RESEND_API_KEY and sender configuration.", 400)
  }

  await db.insert(auditLogs).values({
    userId: user.id,
    organizationId: order.organizationId,
    branchId: order.branchId,
    action: "SEND_ORDER_TOKEN_EMAIL",
    entity: "ORDER",
    entityId: String(order.id),
    metadata: {
      tid: order.tid,
      recipient: TOKEN_EMAIL_RECIPIENT,
    },
  })

  return ok({
    message: "Token email sent successfully",
    recipient: TOKEN_EMAIL_RECIPIENT,
  })
}
