import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, budgets } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { verifyApprovalToken } from "@/lib/approval-token"
import { logFulfillmentAttempt } from "@/lib/global-logger"
import { moveHeldQuantityBudgetToUsedForOrder } from "@/lib/server/product-quantity-budget-ledger"

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  // Only SUPER_ADMIN or HEAD_OFFICE can fulfill
  const err = await requireApiRole(["HEAD_OFFICE", "SUPER_ADMIN"])
  if (err) return err

  const params = await props.params
  const orderId = Number(params.id)
  const user = await getCurrentUser()
  const body = await readJson<{ approvalToken: string }>(req)

  if (!user) return error("Unauthorized", 401)
  if (!body?.approvalToken) return error("Approval token is required", 400)

  // Fetch order
  const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!ord) return error("Order not found", 404)

  // BOLA
  const { verifyResourceAccess } = await import("@/lib/auth")
  const hasAccess = await verifyResourceAccess(ord.organizationId, ord.branchId)
  if (!hasAccess) return error("Forbidden", 403)

  if (ord.status.toUpperCase() !== "APPROVED") {
    return error(`Cannot fulfill order in ${ord.status} state`, 400)
  }

  if (!ord.approvalTokenHash) {
    return error("Order has no approval token - cannot fulfill", 400)
  }

  const isValid = await verifyApprovalToken(body.approvalToken, ord.approvalTokenHash)

  if (!isValid) {
    logFulfillmentAttempt(
      orderId,
      ord.tid,
      user.id,
      user.email || "unknown",
      user.role,
      false,
      "Invalid token provided"
    )
    return error("Invalid approval token - fulfillment denied", 403)
  }

  await db.transaction(async (tx) => {
    // 1. Update order status
    await tx.update(orders).set({
      status: "FULFILLED",
      fulfilledAt: new Date(),
      fulfilledByUserId: user.id,
      updatedAt: new Date()
    }).where(eq(orders.id, orderId))

    // 2. Move budget from held to spent
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
        amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}`,
        amountSpentCents: sql`${budgets.amountSpentCents} + ${ord.totalCents}`,
      }).where(eq(budgets.id, budget.id))
    }

    await moveHeldQuantityBudgetToUsedForOrder(tx, ord)
  })

  return ok({ message: "Order fulfilled successfully" })
}
