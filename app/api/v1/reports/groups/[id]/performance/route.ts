import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { branches, orders, groups } from "@/db/schema"
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
import { error, ok, unauthorized } from "@/lib/api"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await getRequestScope()
    if (!scope) return unauthorized()

    const { id } = await params
    const groupId = parseInt(id)
    if (isNaN(groupId)) return error("Invalid Group ID", 400)

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : new Date()
    const statusFilter = searchParams.get("status") || "FULFILLED"

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1)
      if (!group) return null

      if (scope!.role === "HEAD_OFFICE" && group.organizationId !== scope!.organizationId) {
        throw new Error("Forbidden - Access to this group's performance report is denied")
      }

      const branchList = await tx.select({ id: branches.id, name: branches.name, code: branches.code, status: branches.status }).from(branches).where(eq(branches.groupId, groupId))

      if (branchList.length === 0) {
        return { meta: { groupName: group.name, period: { start: startDate, end: endDate }, totalGroupSpend: 0, totalGroupOrders: 0 }, items: [] }
      }

      const branchIds = branchList.map((b: any) => b.id)
      const metrics = await tx.select({ branchId: orders.branchId, totalOrders: sql<number>`count(${orders.id})::int`, totalSpend: sql<number>`sum(${orders.totalCents})::int`, lastOrderDate: sql<string>`max(${orders.createdAt})` }).from(orders).where(and(inArray(orders.branchId, branchIds), gte(orders.createdAt, startDate), lte(orders.createdAt, endDate), statusFilter !== "ALL" ? eq(sql`UPPER(${orders.status})`, statusFilter.toUpperCase()) : undefined)).groupBy(orders.branchId)

      const metricsMap = new Map(metrics.map((m: any) => [m.branchId, m]))
      let groupTotalSpend = 0; let groupTotalOrders = 0
      const items = branchList.map((branch: any) => {
        const m: any = metricsMap.get(branch.id); const spent = Number(m?.totalSpend || 0); const count = Number(m?.totalOrders || 0)
        groupTotalSpend += spent; groupTotalOrders += count
        return { branchId: branch.id, branchName: branch.name, branchCode: branch.code, branchStatus: branch.status, totalOrders: count, totalSpendCents: spent, averageOrderValueCents: count > 0 ? Math.round(spent / count) : 0, lastActivity: m?.lastOrderDate || null }
      })
      items.sort((a: any, b: any) => b.totalSpendCents - a.totalSpendCents)
      return { meta: { groupName: group.name, period: { start: startDate, end: endDate }, totalGroupSpend: groupTotalSpend, totalGroupOrders: groupTotalOrders }, items }
    }

    if (!result) return error("Group not found", 404)
    return ok(result)
  } catch (e: any) {
    const status = e.message.includes("Forbidden") ? 403 : 500
    return error(e.message || "Internal error", status as any)
  }
}
