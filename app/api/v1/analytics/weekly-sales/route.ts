export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { and, eq, gte, sql, or, lt } from "drizzle-orm"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { metricExpressions } from "@/lib/metric-utils"
import { getRequestScope } from "@/lib/auth"
import { error, ok } from "@/lib/api"

function getCurrentWeekRange() {
  const now = new Date()
  const pakistanOffset = 5 * 60 * 60 * 1000 
  const nowInPK = new Date(now.getTime() + pakistanOffset)
  const dayOfW = nowInPK.getUTCDay()
  const daysToMon = dayOfW === 0 ? 6 : dayOfW - 1
  const monInPK = new Date(nowInPK)
  monInPK.setUTCDate(nowInPK.getUTCDate() - daysToMon)
  monInPK.setUTCHours(0, 0, 0, 0)
  const monUTC = new Date(monInPK.getTime() - pakistanOffset)
  const nextMonPK = new Date(monInPK)
  nextMonPK.setUTCDate(monInPK.getUTCDate() + 7)
  const nextMonUTC = new Date(nextMonPK.getTime() - pakistanOffset)
  const sunPK = new Date(monInPK)
  sunPK.setUTCDate(monInPK.getUTCDate() + 6)
  sunPK.setUTCHours(23, 59, 59, 999)
  const sunUTC = new Date(sunPK.getTime() - pakistanOffset)
  return { monday: monUTC, sunday: sunUTC, nextMonday: nextMonUTC, mondayInPK: monInPK }
}

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

      const { monday, sunday, nextMonday, mondayInPK } = getCurrentWeekRange()
      const dateField = sql`COALESCE(${orders.approvedAt}, ${orders.fulfilledAt}, ${orders.createdAt})`

      const weekConditions: any[] = [
        gte(dateField, monday),
        lt(dateField, nextMonday),
        or(
          eq(sql`UPPER(${orders.status})`, "APPROVED"),
          eq(sql`UPPER(${orders.status})`, "FULFILLED"),
          eq(sql`UPPER(${orders.status})`, "REFUNDED")
        ),
      ]

      if (organizationId) weekConditions.push(eq(orders.organizationId, organizationId))
      if (branchId) weekConditions.push(eq(orders.branchId, branchId))
      if (groupId) weekConditions.push(eq(branches.groupId, groupId))

      const rows = await tx.select({
        day: sql<string>`TO_CHAR((${dateField} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD')`,
        totalCents: metricExpressions.revenue,
        orderCount: sql<number>`coalesce(count(${orders.id}), 0)`,
      }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).where(and(...weekConditions)).groupBy(sql`1`).orderBy(sql`1`)

      const salesMap: Record<string, { sales: number; orderCount: number }> = {}
      rows.forEach((r: any) => { salesMap[r.day] = { sales: (r.totalCents || 0) / 100, orderCount: Number(r.orderCount) } })

      const weekDays = []
      for (let i = 0; i < 7; i++) {
        const dPK = new Date(mondayInPK); dPK.setUTCDate(mondayInPK.getUTCDate() + i)
        const dayKey = `${dPK.getUTCFullYear()}-${String(dPK.getUTCMonth() + 1).padStart(2, '0')}-${String(dPK.getUTCDate()).padStart(2, '0')}`
        const dNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        weekDays.push({ day: dNames[dPK.getUTCDay()], date: dayKey, sales: salesMap[dayKey]?.sales || 0, orderCount: salesMap[dayKey]?.orderCount || 0 })
      }
      return { weekStart: monday.toISOString().slice(0, 10), weekEnd: sunday.toISOString().slice(0, 10), dailySales: weekDays, totalSales: weekDays.reduce((s, d) => s + d.sales, 0), totalOrders: weekDays.reduce((s, d) => s + d.orderCount, 0) }
    }
    return ok(result)
  } catch (e: any) {
    return error(e.message || "Internal error")
  }
}
