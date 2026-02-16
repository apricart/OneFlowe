import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { orders } from "@/db/schema"
import { eq, sql } from "drizzle-orm"
type OrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED"

export async function GET(
  _: Request,
  props: { params: Promise<{ id: string }> }
) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const params = await props.params
  const { id } = params
  const orderId = Number(id)

  const [item] = await db.select().from(orders).where(eq(orders.id, orderId))
  if (!item) return error("Not found", 404)

  // BOLA Protection: Verify user belongs to the same organization/branch as the order
  const { verifyResourceAccess } = await import("@/lib/auth")
  const hasAccess = await verifyResourceAccess(item.organizationId, item.branchId)
  if (!hasAccess) return error("Forbidden: You do not have access to this order", 403)

  return ok({ item })
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  // Head Office approves/rejects; Super Admin can mark fulfilled
  const err = await requireApiRole(["HEAD_OFFICE", "SUPER_ADMIN"])
  if (err) return err

  const params = await props.params
  const { id } = params
  const orderId = Number(id)

  // Check existence and ownership first
  const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!ord) return error("Order not found", 404)

  // BOLA Protection
  const { verifyResourceAccess } = await import("@/lib/auth")
  const hasAccess = await verifyResourceAccess(ord.organizationId, ord.branchId)
  if (!hasAccess) return error("Forbidden: You do not have access to this order", 403)

  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)

  const allowedStatuses: OrderStatus[] = ["APPROVED", "REJECTED", "FULFILLED", "PENDING"]
  if (body.status && !allowedStatuses.includes(body.status)) {
    return error("Invalid status", 400)
  }

  const patch: any = {}

  // ✅ Always update status if provided
  if (body.status) {
    patch.status = body.status
  }
  // Store in UTC (PostgreSQL NOW() returns UTC by default)
  if (body.status === "FULFILLED") {
    patch.fulfilledAt = sql`NOW()`
  }

  const [item] = await db
    .update(orders)
    .set(patch)
    .where(eq(orders.id, orderId))
    .returning()

  return ok({ item })
}


export async function DELETE(
  _: Request,
  props: { params: Promise<{ id: string }> }
) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const params = await props.params
  const { id } = params
  const orderId = Number(id)

  // Fetch order first to verify it exists
  const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!ord) return error("Order not found", 404)

  // BOLA Protection: verify resource access
  const { verifyResourceAccess } = await import("@/lib/auth")
  const hasAccess = await verifyResourceAccess(ord.organizationId, ord.branchId)
  if (!hasAccess) return error("Forbidden: You do not have access to this order", 403)

  await db.delete(orders).where(eq(orders.id, orderId))
  return ok({ success: true })
}

