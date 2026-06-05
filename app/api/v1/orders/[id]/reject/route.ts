import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, budgets, globalProducts, orderItems } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { releaseHeldQuantityBudgetForOrder } from "@/lib/server/product-quantity-budget-ledger"
import { orderSelectColumns } from "@/lib/order-select"

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const err = await requireApiRole(["BRANCH_ADMIN", "HEAD_OFFICE", "SUPER_ADMIN"])
  if (err) return err

  const params = await props.params
  const orderId = Number(params.id)
  const user = await getCurrentUser()
  const body = await readJson<{ reason: string }>(req)

  if (!user) return error("Unauthorized", 401)
  if (!body?.reason) return error("Rejection reason is required", 400)

  // Fetch order
  const [ord] = await db.select(orderSelectColumns).from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!ord) return error("Order not found", 404)

  // BOLA
  const { verifyResourceAccess } = await import("@/lib/auth")
  const hasAccess = await verifyResourceAccess(ord.organizationId, ord.branchId)
  if (!hasAccess) return error("Forbidden", 403)

  if (ord.status.toUpperCase() !== "PENDING") {
    return error(`Cannot reject order in ${ord.status} state`, 400)
  }

  await db.transaction(async (tx) => {
    // 1. Update order status
    await tx.update(orders).set({
      status: "REJECTED",
      rejectedByUserId: user.id,
      rejectedAt: new Date(),
      rejectionReason: body.reason,
      updatedAt: new Date()
    }).where(eq(orders.id, orderId))

    // 2. Restore budget
    const orderMonth = ord.createdAt
      ? new Date(ord.createdAt).toISOString().slice(0, 7)
      : new Date().toISOString().slice(0, 7)

    const [budget] = await tx.select().from(budgets).where(
      and(
        eq(budgets.branchId, ord.branchId),
        eq(budgets.period, orderMonth)
      )
    ).limit(1)

    if (budget) {
      await tx.update(budgets).set({
        amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}`
      }).where(eq(budgets.id, budget.id))
    }

    // 3. Release quantity budget and restore stock
    await releaseHeldQuantityBudgetForOrder(tx, ord)

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    for (const item of items) {
      await tx.update(globalProducts)
        .set({
          stockQuantity: sql`${globalProducts.stockQuantity} + ${item.quantity}`,
          updatedAt: new Date()
        })
        .where(eq(globalProducts.id, item.globalProductId))
    }
  })

  return ok({ message: "Order rejected successfully" })
}
