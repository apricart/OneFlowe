import { NextRequest } from "next/server"
import { and, eq, gte, sql, or, lt } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"
import { getCached, generateCacheKey } from "@/lib/cache-utils"
import { REVENUE_ELIGIBLE_FILTER, metricExpressions } from "@/lib/metric-utils"
import { shouldHidePricesForRole } from "@/lib/price-visibility"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const

type Role = typeof allowedRoles[number]

function getOrderConditions(role: Role | undefined, organizationId: number | null, branchId: number | null) {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 6)
  fromDate.setHours(0, 0, 0, 0)

  const conditions = [gte(orders.createdAt, fromDate)]

  // Revenue rule: FULFILLED + REFUNDED (net of refunds)
  conditions.push(REVENUE_ELIGIBLE_FILTER)

  if (role !== "SUPER_ADMIN" && organizationId) {
    conditions.push(eq(orders.organizationId, organizationId))
  }

  if (role === "BRANCH_ADMIN" && branchId) {
    conditions.push(eq(orders.branchId, branchId))
  }

  return conditions
}

export async function GET(req: NextRequest) {
  const err = await requireApiRole(allowedRoles as any)
  if (err) return err

  const scope = await getRequestScope()
  const role = scope?.role

  const { searchParams } = new URL(req.url)
  const orgIdParam = searchParams.get("organizationId")
  const branchIdParam = searchParams.get("branchId")
  const groupIdParam = searchParams.get("groupId")

  let organizationId: number | null = null
  let branchId: number | null = null
  let groupId: number | null = null

  // BOLA: BRANCH_ADMIN must always use session values, never query params
  if (role === "BRANCH_ADMIN") {
    organizationId = scope?.organizationId ?? null
    branchId = scope?.branchId ?? null
  } else if (role === "HEAD_OFFICE") {
    // HEAD_OFFICE is scoped to their org, but can filter by branch
    organizationId = scope?.organizationId ?? null
    if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
      branchId = Number(branchIdParam)
    }
  } else {
    // SUPER_ADMIN can use query params freely
    if (orgIdParam && orgIdParam !== "null" && orgIdParam !== "0") {
      organizationId = Number(orgIdParam)
    }
    if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
      branchId = Number(branchIdParam)
    }
  }

  if (groupIdParam && groupIdParam !== "null" && groupIdParam !== "0") {
    groupId = Number(groupIdParam)
  }
  const pricesHidden = await shouldHidePricesForRole(role, scope?.organizationId)

  const cacheKey = generateCacheKey('dashboard-analytics', {
    role,
    organizationId,
    branchId,
    groupId,
    pricesHidden,
  })

  const fetchDashboardData = async () => {
    const orderConditions = getOrderConditions(role as Role, organizationId, branchId)
    if (groupId) {
      orderConditions.push(eq(branches.groupId, groupId))
    }
    const whereClause = and(...(orderConditions as any))

    const dayExpr = sql`date_trunc('day', ${orders.createdAt})`
    const gmvQuery = db
      .select({
        day: dayExpr,
        totalCents: metricExpressions.revenue,
      })
      .from(orders)
      .leftJoin(branches, eq(orders.branchId, branches.id))
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
    if (groupId) {
      branchFilters.push(eq(branches.groupId, groupId))
    }

    const branchSelect = db.select({
      id: branches.id,
      name: branches.name,
      orderCount: sql<number>`coalesce(count(${orders.id}), 0)`.mapWith(Number),
    }).from(branches)

    const branchSelectWithFilters = branchFilters.length
      ? branchSelect.where(and(...(branchFilters as any)))
      : branchSelect

    const branchQuery = branchSelectWithFilters
      .leftJoin(
        orders,
        and(eq(orders.branchId, branches.id), ...(orderConditions as any)),
      )
      .groupBy(branches.id)
      .orderBy(sql`coalesce(count(${orders.id}), 0) desc`)
      .limit(role === "BRANCH_ADMIN" ? 1 : 5)

    const countSelect = db.select({ count: sql<number>`coalesce(count(${branches.id}), 0)` }).from(branches)
    const branchCountQuery = branchFilters.length
      ? countSelect.where(and(...(branchFilters as any)))
      : countSelect

    let pendingQuery: Promise<any[]> | null = null
    if (role !== "SUPER_ADMIN") {
      const pendingConditions: any[] = [or(eq(orders.status, "PENDING"), eq(orders.status, "pending"))]
      if (organizationId) {
        pendingConditions.push(eq(orders.organizationId, organizationId))
      }
      if (role === "BRANCH_ADMIN" && branchId) {
        pendingConditions.push(eq(orders.branchId, branchId))
      }

      pendingQuery = db
        .select({ count: sql<number>`coalesce(count(${orders.id}), 0)` })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(and(...(pendingConditions as any)))
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    startOfMonth.setHours(0, 0, 0, 0)
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    startOfNextMonth.setHours(0, 0, 0, 0)

    const monthConditions: any[] = [
      gte(orders.createdAt, startOfMonth),
      lt(orders.createdAt, startOfNextMonth),
      REVENUE_ELIGIBLE_FILTER,
    ]
    if (role !== "SUPER_ADMIN" && organizationId) {
      monthConditions.push(eq(orders.organizationId, organizationId))
    }
    if (role === "BRANCH_ADMIN" && branchId) {
      monthConditions.push(eq(orders.branchId, branchId))
    }

    const ordersMonthQuery = db
      .select({ count: sql<number>`coalesce(count(${orders.id}), 0)` })
      .from(orders)
      .leftJoin(branches, eq(orders.branchId, branches.id))
      .where(and(...(monthConditions as any)))

    // All five aggregates are independent — run them in parallel
    const [gmvRows, branchRows, branchCountRows, pendingRow, ordersMonthRow] = await Promise.all([
      gmvQuery,
      branchQuery,
      branchCountQuery,
      pendingQuery ?? Promise.resolve(null),
      ordersMonthQuery,
    ])

    const branchCount = Number(((branchCountRows as any)[0]?.count) || 0)
    const pendingApprovals = pendingRow ? Number(((pendingRow as any)[0]?.count) || 0) : 0
    const ordersThisMonth = Number(((ordersMonthRow as any)[0]?.count) || 0)

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
      const key = new Date(row.day as any).toISOString().slice(0, 10)
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

    return {
      gmvSeries,
      branchSeries,
      branchCount,
      pendingApprovals,
      ordersThisMonth,
    }
  }

  const data = await getCached(cacheKey, fetchDashboardData, 180)
  return ok(pricesHidden
    ? {
      ...data,
      gmvSeries: data.gmvSeries.map((point: any) => ({ ...point, value: null })),
      pricesHidden,
    }
    : { ...data, pricesHidden })
}
