import { NextRequest, NextResponse } from "next/server"
import { sql, and, eq } from "drizzle-orm"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"
import { metricExpressions } from "@/lib/metric-utils"
import { error, ok } from "@/lib/api"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const orgIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")
    const groupIdParam = searchParams.get("groupId")

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      let organizationId = scope?.organizationId
      if (orgIdParam && scope?.role === "SUPER_ADMIN") organizationId = parseInt(orgIdParam)

      let branchId = (scope?.role === "BRANCH_ADMIN") ? scope.branchId : (branchIdParam ? parseInt(branchIdParam) : null)
      const groupId = groupIdParam ? parseInt(groupIdParam) : null

      const conditions: any[] = []
      if (organizationId) conditions.push(eq(orders.organizationId, organizationId))
      if (branchId) conditions.push(eq(orders.branchId, branchId))
      if (groupId) conditions.push(eq(branches.groupId, groupId))

      const [stats] = await tx
        .select({
          totalOrders: sql<number>`COUNT(*)::int`,
          fulfilledOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END)::int`,
          refundedOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END)::int`,
          rejectedOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END)::int`,
          approvedOrders: sql<number>`COUNT(CASE WHEN UPPER(${orders.status}) = 'APPROVED' THEN 1 END)::int`,
          totalRevenueCents: metricExpressions.revenue,
          grossRevenueCents: sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED') THEN ${orders.totalCents} ELSE 0 END), 0)::bigint`,
          totalRefundedCents: sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED') THEN COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END), 0)::bigint`,
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      return {
        totalOrders: Number(stats?.totalOrders || 0),
        fulfilledOrders: Number(stats?.fulfilledOrders || 0),
        refundedOrders: Number(stats?.refundedOrders || 0),
        rejectedOrders: Number(stats?.rejectedOrders || 0),
        approvedOrders: Number(stats?.approvedOrders || 0),
        totalRevenue: Number(stats?.totalRevenueCents || 0) / 100,
        grossRevenue: Number(stats?.grossRevenueCents || 0) / 100,
        totalRefunded: Number(stats?.totalRefundedCents || 0) / 100,
      }
    }

    return ok(result)
  } catch (e: any) {
    return error(e.message || "Internal error")
  }
}
