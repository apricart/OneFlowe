import { ok, error, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { orders } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { generateApprovalToken, hashApprovalToken } from "@/lib/approval-token"
import { logTokenGenerated } from "@/lib/global-logger"

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  // BRANCH_ADMIN can approve orders for their branch
  const err = await requireApiRole(["BRANCH_ADMIN", "HEAD_OFFICE", "SUPER_ADMIN"])
  if (err) return err

  const params = await props.params
  const orderId = Number(params.id)
  const user = await getCurrentUser()

  if (!user) return error("Unauthorized", 401)

  // Fetch order
  const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!ord) return error("Order not found", 404)

  // BOLA: Verify user has access to this order's branch
  const { verifyResourceAccess } = await import("@/lib/auth")
  const hasAccess = await verifyResourceAccess(ord.organizationId, ord.branchId)
  if (!hasAccess) return error("Forbidden", 403)

  if (ord.status.toUpperCase() !== "PENDING") {
    return error(`Cannot approve order in ${ord.status} state`, 400)
  }

  // Generate secure approval token
  const plainToken = generateApprovalToken(10)
  const tokenHash = await hashApprovalToken(plainToken)

  await db.update(orders).set({
    status: "APPROVED",
    approvedByUserId: user.id,
    approvedAt: new Date(),
    approvalToken: plainToken,
    approvalTokenHash: tokenHash,
    approvalTokenCreatedAt: new Date(),
    updatedAt: new Date()
  }).where(eq(orders.id, orderId))

  // Log token generation
  logTokenGenerated(
    orderId,
    ord.tid,
    user.id,
    user.email || "unknown"
  )

  return ok({
    message: "Order approved successfully",
    approvalToken: plainToken,
    warning: "SAVE THIS TOKEN! It will not be shown again."
  })
}
