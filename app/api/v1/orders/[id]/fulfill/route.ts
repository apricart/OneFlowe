import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { orders, budgets } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { NextRequest, NextResponse } from "next/server"
import { verifyApprovalToken } from "@/lib/approval-token"
import { logFulfillmentAttempt } from "@/lib/global-logger"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    // CRITICAL: Only SUPER_ADMIN can fulfill orders
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden - Only Super Admin can fulfill orders" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { approvalToken } = body
    if (!approvalToken) return NextResponse.json({ error: "Approval token is required" }, { status: 400 })

    const params = await props.params
    const orderId = Number(params.id)
    if (isNaN(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    await runner(async (tx: any) => {
      // Fetch order
      const [ord] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
      if (!ord) throw new Error("Order not found or access denied")

      if (ord.status.toUpperCase() !== "APPROVED") {
        throw new Error(`Cannot fulfill order in ${ord.status} state`)
      }

      if (!ord.approvalTokenHash) {
        throw new Error("Order has no approval token - cannot fulfill")
      }

      const isValid = await verifyApprovalToken(approvalToken, ord.approvalTokenHash)

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
        throw new Error("Invalid approval token - fulfillment denied")
      }

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
    })

    return NextResponse.json({ message: "Order fulfilled successfully" })
  } catch (err: any) {
    console.error("Order Fulfillment Error:", err)
    const status = err.message.includes("not found") ? 404 : (err.message.includes("denied") ? 403 : 400)
    return NextResponse.json({ error: err.message || "Failed to fulfill order" }, { status: status })
  }
}

