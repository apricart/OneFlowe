import { db, withTenant } from "@/lib/db"
import { orders } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { NextRequest, NextResponse } from "next/server"
import { generateApprovalToken, hashApprovalToken } from "@/lib/approval-token"
import { logTokenGenerated } from "@/lib/global-logger"

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

    const params = await props.params
    const orderId = Number(params.id)
    if (isNaN(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })

    const result = await withTenant(user, async (tx) => {
      // Fetch order
      const [ord] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
      if (!ord) throw new Error("Order not found or access denied")

      if (ord.status.toUpperCase() !== "PENDING") {
        throw new Error(`Cannot approve order in ${ord.status} state`)
      }

      // Generate secure approval token
      const plainToken = generateApprovalToken(10)
      const tokenHash = await hashApprovalToken(plainToken)

      await tx.update(orders).set({
        status: "APPROVED",
        approvedByUserId: user.id,
        approvedAt: new Date(),
        approvalToken: plainToken,
        approvalTokenHash: tokenHash,
        approvalTokenCreatedAt: new Date(),
        updatedAt: new Date()
      }).where(eq(orders.id, orderId))

      // Log token generation (outside transaction is fine or inside)
      logTokenGenerated(
        orderId,
        ord.tid,
        user.id,
        user.email || "unknown"
      )

      return { plainToken }
    })

    return NextResponse.json({
      message: "Order approved successfully",
      approvalToken: result.plainToken,
      warning: "SAVE THIS TOKEN! It will not be shown again."
    })
  } catch (err: any) {
    console.error("Order Approval Error:", err)
    const status = err.message.includes("not found") ? 404 : 400
    return NextResponse.json({ error: err.message || "Failed to approve order" }, { status: status })
  }
}

