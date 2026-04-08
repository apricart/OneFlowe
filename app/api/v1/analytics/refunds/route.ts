import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, branches, organizations } from "@/db/schema"
import { eq, and, gte, lte, or, gt, sql, inArray } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
import { error, ok } from "@/lib/api"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const orgIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const groupId = searchParams.get("groupId")

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const conditions: any[] = [
        or(
          eq(sql`UPPER(${orders.status})`, "REFUNDED"),
          gt(orders.refundAmountCents, 0)
        )
      ]

      if (orgIdParam && scope!.role === "SUPER_ADMIN") conditions.push(eq(orders.organizationId, parseInt(orgIdParam)))
      if (branchIdParam) conditions.push(eq(orders.branchId, parseInt(branchIdParam)))

      if (startDate) conditions.push(gte(orders.refundedAt, new Date(startDate)))
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        conditions.push(lte(orders.refundedAt, end))
      }

      if (groupId && groupId !== "all") {
        const branchesInGroup = await tx.select({ id: branches.id }).from(branches).where(eq(branches.groupId, parseInt(groupId)))
        if (branchesInGroup.length > 0) {
          conditions.push(inArray(orders.branchId, branchesInGroup.map((b: any) => b.id)))
        } else {
          return { items: [], count: 0 }
        }
      }

      const refundedOrders = await tx
        .select({
          id: orders.id, tid: orders.tid, organizationId: orders.organizationId, organizationName: organizations.name,
          branchId: orders.branchId, branchName: branches.name, status: orders.status, statusAtRefund: orders.statusAtRefund,
          orderTotal: orders.totalCents, refundAmount: orders.refundAmountCents, reason: orders.refundReason,
          createdAt: orders.createdAt, refundedAt: orders.refundedAt
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .leftJoin(organizations, eq(orders.organizationId, organizations.id))
        .where(and(...conditions))
        .orderBy(sql`${orders.refundedAt} DESC NULLS LAST`)
        .limit(500)

      const itemsWithType = refundedOrders.map((order: any) => ({
        ...order,
        refundType: (order.refundAmount || 0) >= (order.orderTotal || 0) ? "FULL" : "PARTIAL"
      }))

      return { items: itemsWithType, count: itemsWithType.length }
    }

    return ok(result)
  } catch (e: any) {
    return error(e.message || "Internal error")
  }
}
