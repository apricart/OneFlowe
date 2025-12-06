import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { refunds, orders, budgets, auditLogs, users } from "@/db/schema"
import { eq, sql, desc } from "drizzle-orm"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const { id } = await params
    const orderId = parseInt(id)
    if (!Number.isFinite(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })

    // Get order details first to check permissions
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const userRole = (session.user as any).role
    const userOrgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId

    // Check permissions
    if (userRole === "BRANCH_ADMIN" && (order as any).branchId !== userBranchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (userRole === "HEAD_OFFICE" && (order as any).organizationId !== userOrgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch refunds with user details
    const refundsData = await db
      .select({
        id: refunds.id,
        amountCents: refunds.amountCents,
        reason: refunds.reason,
        createdAt: refunds.createdAt,
        status: refunds.status,
        requestedByUserId: refunds.requestedByUserId,
        processedByUserId: refunds.processedByUserId,
        processedByUser: {
          email: users.email,
          fullName: users.fullName,
        }
      })
      .from(refunds)
      .leftJoin(users, eq(refunds.processedByUserId, users.id))
      .where(eq(refunds.orderId, orderId))
      .orderBy(desc(refunds.createdAt))

    return NextResponse.json({ refunds: refundsData })
  } catch (error: any) {
    console.error("Error fetching refunds:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const orderId = parseInt(id)
    const body = await req.json()
    const { amountCents, reason } = body as { amountCents: number, reason?: string }
    if (!amountCents || amountCents <= 0) return NextResponse.json({ error: 'Positive amountCents required' }, { status: 400 })

    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!ord) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const userRole = (session.user as any).role
    const userId = (session.user as any).id as string

    await db.transaction(async (tx) => {
      if (userRole === "SUPER_ADMIN") {
        // Super Admin: approve/process refund and adjust budgets
        await tx.insert(refunds).values({
          organizationId: (ord as any).organizationId,
          orderId,
          amountCents,
          reason: reason || null,
          status: "APPROVED",
          processedByUserId: userId,
        })

        const [budget] = await tx.select().from(budgets).where(eq(budgets.branchId, (ord as any).branchId)).limit(1)
        if (budget) {
          await tx
            .update(budgets)
            .set({
              amountSpentCents: sql`${budgets.amountSpentCents} - ${amountCents}`,
              amountCreditedCents: sql`${budgets.amountCreditedCents} + ${amountCents}`,
            })
            .where(eq(budgets.id, (budget as any).id))
        }

        // if full refund, mark order refunded
        if (amountCents >= (ord as any).totalCents) {
          await tx.update(orders).set({ status: "refunded" }).where(eq(orders.id, orderId))
        }

        await tx.insert(auditLogs).values({
          userId,
          action: "REFUND_APPROVED",
          entity: "Order",
          entityId: String(orderId),
          organizationId: (ord as any).organizationId,
          branchId: (ord as any).branchId,
          metadata: { tid: (ord as any).tid, amountCents, reason },
        })
      } else {
        // Branch Admin / Head Office: create refund REQUEST only (no budget changes)
        await tx.insert(refunds).values({
          organizationId: (ord as any).organizationId,
          orderId,
          amountCents,
          reason: reason || null,
          status: "PENDING",
          requestedByUserId: userId,
        })

        await tx.insert(auditLogs).values({
          userId,
          action: "REFUND_REQUESTED",
          entity: "Order",
          entityId: String(orderId),
          organizationId: (ord as any).organizationId,
          branchId: (ord as any).branchId,
          metadata: { tid: (ord as any).tid, amountCents, reason },
        })
      }
    })

    return NextResponse.json({
      message: userRole === "SUPER_ADMIN" ? "Refund recorded" : "Refund request submitted",
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


