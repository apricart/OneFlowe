import { NextRequest } from "next/server"
import { and, eq, gte, sql, or, lt } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import type { Role } from "@/lib/rbac"

const allowedRoles: Role[] = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"]

function getOrderConditions(role: Role, organizationId: number | null, branchId: number | null) {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 6)
  fromDate.setHours(0, 0, 0, 0)

  const conditions = [gte(orders.createdAt, fromDate)]

  if (role === "SUPER_ADMIN") {
    conditions.push(sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED')`)
  }

  if (role !== "SUPER_ADMIN" && organizationId) {
    conditions.push(eq(orders.organizationId, organizationId))
  }

  if (role === "BRANCH_ADMIN" && branchId) {
    conditions.push(eq(orders.branchId, branchId))
  }

  return conditions
}

export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireApiRole(allowedRoles)
  if (authError) return authError

  const role = user!.role
  const organizationIdFromSession = user!.organizationId
  const branchIdFromSession = user!.branchId

  // Get filter parameters from query string (for UI context selection)
  const { searchParams } = new URL(req.url)
  const orgIdParam = searchParams.get("organizationId")
  const branchIdParam = searchParams.get("branchId")

  // Use query params if provided, otherwise fall back to auth scope
  let organizationId: number | null = null
  let branchId: number | null = null

  if (orgIdParam && orgIdParam !== "null" && orgIdParam !== "0") {
    organizationId = Number(orgIdParam)
  } else if (role !== "SUPER_ADMIN" && organizationIdFromSession) {
    organizationId = organizationIdFromSession
  }

  if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
    branchId = Number(branchIdParam)
  } else if (role === "BRANCH_ADMIN" && branchIdFromSession) {
    branchId = branchIdFromSession
  }

  const orderConditions = getOrderConditions(role, organizationId, branchId)
  const whereClause = and(...orderConditions)

  const dayExpr = sql`date_trunc('day', ${orders.createdAt})`
  const gmvRows = await db
    .select({
      day: dayExpr,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
    })
    .from(orders)
    .where(whereClause)
    .groupBy(dayExpr)
    .orderBy(dayExpr)

  const branchFilters = []
  if (role !== "SUPER_ADMIN" && organizationId) {
    branchFilters.push(eq(branches.organizationId, organizationId))
  }
  if (role === "BRANCH_ADMIN" && branchId) {
    branchFilters.push(eq(branches.id, branchId))
  }

  const branchSelect = db.select({
    id: branches.id,
    name: branches.name,
    orderCount: sql<number>`coalesce(count(${orders.id}), 0)`,
  }).from(branches)

  const branchSelectWithFilters = branchFilters.length
    ? branchSelect.where(and(...branchFilters))
    : branchSelect

  const branchQuery = branchSelectWithFilters
    .leftJoin(
      orders,
      and(eq(orders.branchId, branches.id), ...orderConditions),
    )
    .groupBy(branches.id)
    .orderBy(sql`coalesce(count(${orders.id}), 0) desc`)
    .limit(role === "BRANCH_ADMIN" ? 1 : 5)

  const branchRows = await branchQuery

  // Count branches matching the same filters (or all branches for SUPER_ADMIN)
  const countSelect = db.select({ count: sql<number>`coalesce(count(${branches.id}), 0)` }).from(branches)
  const branchCountRows = branchFilters.length
    ? await countSelect.where(and(...branchFilters))
    : await countSelect

  const branchCount = Number(branchCountRows[0]?.count || 0)

  // Pending approvals: count orders with status PENDING for the same scope (no date filter)
  // Pending approvals: count orders with status PENDING for the same scope (no date filter)
  // Super Admin does NOT see pending orders, so return 0. Only Branch Admin/Head Office need this.
  let pendingApprovals = 0
  if (role !== "SUPER_ADMIN") {
    const pendingConditions: any[] = [or(eq(orders.status, "PENDING"), eq(orders.status, "pending"))]
    if (organizationId) {
      pendingConditions.push(eq(orders.organizationId, organizationId))
    }
    if (role === "BRANCH_ADMIN" && branchId) {
      pendingConditions.push(eq(orders.branchId, branchId))
    }

    const pendingRow = await db
      .select({ count: sql<number>`coalesce(count(${orders.id}), 0)` })
      .from(orders)
      .where(and(...pendingConditions))

    pendingApprovals = Number(pendingRow[0]?.count || 0)
  }

  // Orders this month: Only include APPROVED or FULFILLED orders (exclude PENDING, REJECTED, REFUNDED)
  // Use explicit date range for current month to avoid timezone issues
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  startOfMonth.setHours(0, 0, 0, 0)
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  startOfNextMonth.setHours(0, 0, 0, 0)

  const monthConditions: any[] = [
    gte(orders.createdAt, startOfMonth),
    lt(orders.createdAt, startOfNextMonth),
    or(
      eq(orders.status, "APPROVED"),
      eq(orders.status, "approved"),
      eq(orders.status, "FULFILLED"),
      eq(orders.status, "fulfilled")
    ),
  ]
  if (role !== "SUPER_ADMIN" && organizationId) {
    monthConditions.push(eq(orders.organizationId, organizationId))
  }
  if (role === "BRANCH_ADMIN" && branchId) {
    monthConditions.push(eq(orders.branchId, branchId))
  }

  const ordersMonthRow = await db
    .select({ count: sql<number>`coalesce(count(${orders.id}), 0)` })
    .from(orders)
    .where(and(...monthConditions))

  const ordersThisMonth = Number(ordersMonthRow[0]?.count || 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }).map((_, index) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - index))
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      key: d.toISOString().slice(0, 10),
    }
  })

  const gmvMap: Record<string, number> = {}
  for (const row of gmvRows) {
    const key = new Date(row.day as Date).toISOString().slice(0, 10)
    gmvMap[key] = (row.totalCents || 0) / 100
  }

  const gmvSeries = days.map(day => ({
    label: day.label,
    value: Number(gmvMap[day.key]?.toFixed(2) || 0),
  }))

  const branchSeries = branchRows.map(row => ({
    label: row.name || "Unnamed",
    value: Number(row.orderCount || 0),
  }))

  return ok({
    gmvSeries,
    branchSeries,
    branchCount,
    pendingApprovals,
    ordersThisMonth,
  })
}

