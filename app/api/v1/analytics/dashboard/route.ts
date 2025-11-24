import { NextRequest } from "next/server"
import { and, eq, gte, sql } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const

type Role = typeof allowedRoles[number]

function getOrderConditions(role: Role | undefined, organizationId: number | null, branchId: number | null) {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 6)
  fromDate.setHours(0, 0, 0, 0)

  const conditions = [gte(orders.createdAt, fromDate)]

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
  const organizationId = scope?.organizationId ?? null
  const branchId = scope?.branchId ?? null

  const orderConditions = getOrderConditions(role, organizationId, branchId)
  const whereClause = and(...(orderConditions as any))

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

  let branchQuery = db
    .select({
      id: branches.id,
      name: branches.name,
      orderCount: sql<number>`coalesce(count(${orders.id}), 0)`,
    })
    .from(branches)
    .leftJoin(
      orders,
      and(eq(orders.branchId, branches.id), ...(orderConditions as any)),
    )
    .groupBy(branches.id)
    .orderBy(sql`coalesce(count(${orders.id}), 0) desc`)
    .limit(role === "BRANCH_ADMIN" ? 1 : 5)

  if (branchFilters.length) {
    branchQuery = branchQuery.where(and(...(branchFilters as any)))
  }

  const branchRows = await branchQuery

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

  return ok({
    gmvSeries,
    branchSeries,
  })
}

