import { NextRequest, NextResponse } from "next/server"
import { and, eq, gte, sql, or, lt } from "drizzle-orm"
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
    const yearParam = searchParams.get("year")
    const groupIdParam = searchParams.get("groupId")

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      let organizationId = scope?.organizationId
      if (orgIdParam && scope?.role === "SUPER_ADMIN") organizationId = parseInt(orgIdParam)

      let branchId = (scope?.role === "BRANCH_ADMIN") ? scope.branchId : (branchIdParam ? parseInt(branchIdParam) : null)
      const groupId = groupIdParam ? parseInt(groupIdParam) : null

      const currentYear = new Date().getFullYear()
      const year = yearParam ? Number(yearParam) : currentYear

      const pakistanOffset = 5 * 60 * 60 * 1000 
      const yearStartPK = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
      const yearStart = new Date(yearStartPK.getTime() - pakistanOffset)
      const nextYearStartPK = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0))
      const nextYearStart = new Date(nextYearStartPK.getTime() - pakistanOffset)

      const dateField = sql`COALESCE(${orders.approvedAt}, ${orders.fulfilledAt}, ${orders.createdAt})`

      const monthConditions: any[] = [
        sql`${dateField} IS NOT NULL`,
        gte(dateField, yearStart),
        lt(dateField, nextYearStart),
        or(
          eq(sql`UPPER(${orders.status})`, "APPROVED"),
          eq(sql`UPPER(${orders.status})`, "FULFILLED"),
          eq(sql`UPPER(${orders.status})`, "REFUNDED")
        ),
      ]

      if (organizationId) monthConditions.push(eq(orders.organizationId, organizationId))
      if (branchId) monthConditions.push(eq(orders.branchId, branchId))
      if (groupId) monthConditions.push(eq(branches.groupId, groupId))

      const monthlySalesRows = await tx
        .select({
          monthNum: sql<number>`EXTRACT(MONTH FROM (${dateField} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')::int`,
          month: sql<string>`TO_CHAR((${dateField} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'Mon')`,
          totalCents: metricExpressions.revenue,
          orderCount: sql<number>`coalesce(count(${orders.id}), 0)`,
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(and(...monthConditions))
        .groupBy(sql`1,2`)
        .orderBy(sql`1`)

      const salesMap: Record<string, { sales: number; orderCount: number }> = {}
      for (const row of monthlySalesRows) {
        salesMap[row.month] = {
          sales: (row.totalCents || 0) / 100,
          orderCount: Number(row.orderCount || 0),
        }
      }

      const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const monthlyData = monthsOrder.map(month => ({
        month,
        sales: salesMap[month]?.sales || 0,
        orderCount: salesMap[month]?.orderCount || 0,
      }))

      return {
        year,
        monthlySales: monthlyData,
        totalSales: monthlyData.reduce((sum, month) => sum + month.sales, 0),
        totalOrders: monthlyData.reduce((sum, month) => sum + month.orderCount, 0),
      }
    }

    return ok(result)
  } catch (e: any) {
    return error(e.message || "Internal error")
  }
}
