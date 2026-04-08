import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { orders, budgets, globalProducts, orderItems } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    const allowedRoles = ["BRANCH_ADMIN", "HEAD_OFFICE", "SUPER_ADMIN"]
    if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { reason } = body
    if (!reason) return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })

    const params = await props.params
    const orderId = Number(params.id)
    if (isNaN(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    await runner(async (tx: any) => {
      // Fetch order
      const [ord] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
      if (!ord) throw new Error("Order not found or access denied")

      if (ord.status.toUpperCase() !== "PENDING") {
        throw new Error(`Cannot reject order in ${ord.status} state`)
      }

      // 1. Update order status
      await tx.update(orders).set({
        status: "REJECTED",
        rejectedByUserId: user.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
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

      // 3. Restore stock
      const itemsList = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
      for (const item of itemsList) {
        await tx.update(globalProducts)
          .set({
            stockQuantity: sql`${globalProducts.stockQuantity} + ${item.quantity}`,
            updatedAt: new Date()
          })
          .where(eq(globalProducts.id, item.globalProductId))
      }
    })

    return NextResponse.json({ message: "Order rejected successfully" })
  } catch (err: any) {
    console.error("Order Rejection Error:", err)
    const status = err.message.includes("not found") ? 404 : 400
    return NextResponse.json({ error: err.message || "Failed to reject order" }, { status: status })
  }
}

