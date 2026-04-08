import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant } from "@/lib/db"
import { orders, orderItems, globalProducts, refunds, refundItems, budgets } from "@/db/schema"
import { and, eq, sql } from "drizzle-orm"
type OrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELLED"

export async function GET(
  _: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await props.params
    const { id } = params
    const orderId = Number(id)

    const [item] = await withTenant(session.user as any, async (tx) => 
      tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    ) as any[]

    if (!item) {
      return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 })
    }

    // SECURITY: Strip approval token from response — only Branch Admin approver can see it
    const currentUserId = (session?.user as any)?.id
    const currentRole = (session?.user as any)?.role

    const { approvalToken, approvalTokenHash, approvalTokenCreatedAt, ...safeItem } = item

    // Only include the plaintext token if current user is BRANCH_ADMIN and is the approver
    const isBranchAdminApprover = currentRole === "BRANCH_ADMIN" && item.approvedByUserId === currentUserId

    // Fetch items for this order
    const itemsData = await withTenant(session.user as any, async (tx) => 
      tx
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
    ) as any[]

    return NextResponse.json({
      item: {
        ...safeItem,
        orderItems: itemsData,
        approvalToken: isBranchAdminApprover ? approvalToken : null,
      }
    })
  } catch (err: any) {
    console.error("Order GET error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await props.params
    const { id } = params
    const orderId = Number(id)

    const [ord] = await withTenant(session.user as any, async (tx) => 
      tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    ) as any[]
    
    if (!ord) {
      return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN" && userRole !== "HEAD_OFFICE") {
      return NextResponse.json({ error: "Forbidden: Head Office or Super Admin required" }, { status: 403 })
    }

    const body = await req.json()
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

    const allowedStatuses: OrderStatus[] = ["APPROVED", "REJECTED", "FULFILLED", "PENDING", "CANCELLED"]
    if (body.status && !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const patch: any = {}
    if (body.status) {
      patch.status = body.status
    }

    const [item] = await withTenant(session.user as any, async (tx) => {
      // Determine the month the order belongs to for budget lookup
      const orderMonth = ord.createdAt
        ? new Date(ord.createdAt).toISOString().slice(0, 7)
        : new Date().toISOString().slice(0, 7)
      
      // Find the budget record
      const [budget] = await tx.select().from(budgets).where(
        and(
          eq(budgets.branchId, ord.branchId),
          eq(budgets.period, orderMonth)
        )
      ).limit(1) as any[]

      if (body.status === "REJECTED" || body.status === "CANCELLED") {
        // Transitioning to rejected/cancelled, so restore budget & stock
        if (budget && ord.status !== "REJECTED" && ord.status !== "CANCELLED" && ord.status !== "REFUNDED" && ord.status !== "FULFILLED") {
          await tx.update(budgets).set({ 
            amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}` 
          }).where(eq(budgets.id, budget.id))
        }

        // Restore stock
        const itemsList = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)) as any[]
        for (const item of itemsList) {
          await tx.update(globalProducts)
            .set({
              stockQuantity: sql`${globalProducts.stockQuantity} + ${item.quantity}`,
              updatedAt: new Date()
            })
            .where(eq(globalProducts.id, item.globalProductId))
        }

        if (body.status === "REJECTED") {
           patch.rejectedByUserId = (session.user as any).id
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
        patch.fulfilledByUserId = (session.user as any).id
      }

      return await tx.update(orders)
        .set(patch)
        .where(eq(orders.id, orderId))
        .returning()
    }) as any[]

    return NextResponse.json({ item })
  } catch (err: any) {
    console.error("Order PATCH error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}


export async function DELETE(
  _: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Super Admin required" }, { status: 403 })
    }

    const params = await props.params
    const { id } = params
    const orderId = Number(id)

    const [ord] = await withTenant(session.user as any, async (tx) => 
      tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    ) as any[]
    
    if (!ord) {
      return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 })
    }

    await withTenant(session.user as any, async (tx) => 
      tx.delete(orders).where(eq(orders.id, orderId))
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Order DELETE error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

