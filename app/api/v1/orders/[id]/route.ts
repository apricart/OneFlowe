import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, orderItems, globalProducts, refunds, refundItems } from "@/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { shouldHidePricesForRole } from "@/lib/price-visibility"
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

  // SECURITY: Strip approval token from response — only Branch Admin approver can see it
  const session = await getServerSession(authOptions)
  const currentUserId = (session?.user as any)?.id
  const currentRole = (session?.user as any)?.role
  const pricesHidden = await shouldHidePricesForRole(currentRole, item.organizationId)

  const { approvalToken, approvalTokenHash, approvalTokenCreatedAt, ...safeItem } = item

  // Only include the plaintext token if current user is BRANCH_ADMIN and is the approver
  const isBranchAdminApprover = currentRole === "BRANCH_ADMIN" && item.approvedByUserId === currentUserId

  // Fetch items for this order
  const itemsData = await db
    .select({
      id: orderItems.id,
      productName: orderItems.productName,
      productCode: orderItems.productCode,
      quantity: orderItems.quantity,
      priceCents: orderItems.priceCents,
      unit: orderItems.unit,
      globalProductId: orderItems.globalProductId,
      imageUrl: globalProducts.imageUrl,
      quantityRefunded: sql<number>`COALESCE((
        SELECT SUM(${refundItems.quantity})::int
        FROM ${refundItems}
        JOIN ${refunds} ON ${refundItems.refundId} = ${refunds.id}
        WHERE ${refundItems.orderItemId} = ${orderItems.id}
        AND UPPER(${refunds.status}) = 'APPROVED'
      ), 0)`.mapWith(Number),
    })
    .from(orderItems)
    .leftJoin(globalProducts, eq(orderItems.globalProductId, globalProducts.id))
    .where(eq(orderItems.orderId, orderId))

  return ok({
    item: {
      ...(pricesHidden
        ? {
          ...safeItem,
          subtotalCents: null,
          taxCents: null,
          totalCents: null,
          refundAmountCents: null,
        }
        : safeItem),
      orderItems: pricesHidden
        ? itemsData.map((orderItem) => ({ ...orderItem, priceCents: null }))
        : itemsData,
      approvalToken: isBranchAdminApprover ? approvalToken : null,
      pricesHidden,
    }
  })
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

  const session = await getServerSession(authOptions)
  const patch: any = {}

  // ✅ Always update status if provided
  if (body.status) {
    patch.status = body.status
  }
  // Store in UTC (PostgreSQL NOW() returns UTC by default)
  if (body.status === "FULFILLED") {
    patch.fulfilledAt = sql`NOW()`
  }

  const [item] = await db.transaction(async (tx) => {
    // Determine the month the order belongs to for budget lookup
    const orderMonth = ord.createdAt
      ? new Date(ord.createdAt).toISOString().slice(0, 7)
      : new Date().toISOString().slice(0, 7)
    
    // Find the budget record
    const { budgets, globalProducts, orderItems } = await import("@/db/schema")
    const [budget] = await tx.select().from(budgets).where(
      and(
        eq(budgets.branchId, ord.branchId),
        eq(budgets.period, orderMonth)
      )
    ).limit(1)

    if (body.status === "REJECTED" || body.status === "CANCELLED") {
      // Transitioning to rejected/cancelled, so restore budget & stock
      if (budget && ord.status !== "REJECTED" && ord.status !== "CANCELLED" && ord.status !== "REFUNDED" && ord.status !== "FULFILLED") {
        await tx.update(budgets).set({ 
          amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}` 
        }).where(eq(budgets.id, budget.id))
      }

      // Restore stock
      const itemsList = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
      for (const item of itemsList) {
        await tx.update(globalProducts)
          .set({
            stockQuantity: sql`${globalProducts.stockQuantity} + ${item.quantity}`,
            updatedAt: new Date()
          })
          .where(eq(globalProducts.id, item.globalProductId))
      }

      if (body.status === "REJECTED") {
         patch.rejectedByUserId = session?.user ? (session.user as any).id : null
         patch.rejectedAt = new Date()
      }
    } 
    else if (body.status === "FULFILLED") {
      // Transitioning to fulfilled, move from held to spent
      if (budget && ord.status !== "FULFILLED") {
        await tx.update(budgets).set({
          amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}`,
          amountSpentCents: sql`${budgets.amountSpentCents} + ${ord.totalCents}`,
        }).where(eq(budgets.id, budget.id))
      }
      patch.fulfilledAt = sql`NOW()`
      patch.fulfilledByUserId = session?.user ? (session.user as any).id : null
    }

    return await tx.update(orders)
      .set(patch)
      .where(eq(orders.id, orderId))
      .returning()
  })

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

