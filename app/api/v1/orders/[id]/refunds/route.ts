import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { refunds, orders, budgets, auditLogs } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const orderId = parseInt(params.id)
    const body = await req.json()
    const { amountCents, reason } = body as { amountCents: number, reason?: string }
    if (!amountCents || amountCents <= 0) return NextResponse.json({ error: 'Positive amountCents required' }, { status: 400 })

    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!ord) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    await db.transaction(async (tx) => {
      await tx.insert(refunds).values({ 
        organizationId: (ord as any).organizationId,
        orderId, 
        amountCents, 
        reason: reason || null, 
        processedByUserId: (session.user as any).id,
      })

      const [budget] = await tx.select().from(budgets).where(eq(budgets.branchId, (ord as any).branchId)).limit(1)
      if (budget) {
        await tx.update(budgets).set({ amountSpentCents: sql`${budgets.amountSpentCents} - ${amountCents}`, amountCreditedCents: sql`${budgets.amountCreditedCents} + ${amountCents}` }).where(eq(budgets.id, (budget as any).id))
      }

      // if full refund, mark order refunded
      if (amountCents >= (ord as any).totalCents) {
        await tx.update(orders).set({ status: 'refunded' }).where(eq(orders.id, orderId))
      }

      await tx.insert(auditLogs).values({ userId: (session.user as any).id, action: 'REFUND', entity: 'Order', entityId: String(orderId), organizationId: (ord as any).organizationId, branchId: (ord as any).branchId, metadata: { tid: (ord as any).tid, amountCents, reason } })
    })

    return NextResponse.json({ message: 'Refund recorded' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


