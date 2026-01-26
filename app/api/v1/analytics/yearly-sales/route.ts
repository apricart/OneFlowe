import { NextRequest } from "next/server"
import { and, eq, gte, sql, or, lt } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, branches } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const

type Role = typeof allowedRoles[number]

export async function GET(req: NextRequest) {
  const err = await requireApiRole(allowedRoles as any)
  if (err) return err

  const scope = await getRequestScope()
  const role = scope?.role

  // Get filter parameters from query string (for UI context selection)
  const { searchParams } = new URL(req.url)
  const orgIdParam = searchParams.get("organizationId")
  const branchIdParam = searchParams.get("branchId")
  const yearParam = searchParams.get("year")
  const groupIdParam = searchParams.get("groupId")

  // Use query params if provided, otherwise fall back to auth scope
  let organizationId: number | null = null
  let branchId: number | null = null
  let groupId: number | null = null

  if (orgIdParam && orgIdParam !== "null" && orgIdParam !== "0") {
    organizationId = Number(orgIdParam)
  } else if (role !== "SUPER_ADMIN" && scope?.organizationId) {
    organizationId = scope.organizationId
  }

  if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
    branchId = Number(branchIdParam)
  } else if (role === "BRANCH_ADMIN" && scope?.branchId) {
    branchId = scope.branchId
  }

  if (groupIdParam && groupIdParam !== "null" && groupIdParam !== "0") {
    groupId = Number(groupIdParam)
  }

  // Get year from query param or use current year
  const currentYear = new Date().getFullYear()
  const year = yearParam ? Number(yearParam) : currentYear

  // Calculate start and end of the year in Pakistan timezone (UTC+5)
  // Then convert to UTC for database comparison
  const pakistanOffset = 5 * 60 * 60 * 1000 // UTC+5 in milliseconds

  // Year start in Pakistan timezone (January 1st, 00:00:00 PK time)
  const yearStartPK = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
  // Convert to UTC for database (subtract 5 hours)
  const yearStart = new Date(yearStartPK.getTime() - pakistanOffset)

  // Year end in Pakistan timezone (December 31st, 23:59:59 PK time)
  const yearEndPK = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
  // Convert to UTC for database
  const yearEnd = new Date(yearEndPK.getTime() - pakistanOffset)

  // Next year start in Pakistan timezone
  const nextYearStartPK = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0))
  const nextYearStart = new Date(nextYearStartPK.getTime() - pakistanOffset)

  // Build conditions for yearly sales
  // ONLY include FULFILLED orders with fulfilledAt date (exclude PENDING, REJECTED, REFUNDED, APPROVED)
  const yearConditions: any[] = [
    sql`${orders.fulfilledAt} IS NOT NULL`,
    gte(orders.fulfilledAt, yearStart),
    lt(orders.fulfilledAt, nextYearStart),
    or(
      eq(orders.status, "FULFILLED"),
      eq(orders.status, "fulfilled")
    ), // Only FULFILLED status, not approved
  ]

  // Apply organization filter (if not SUPER_ADMIN or if explicitly selected)
  if (organizationId) {
    yearConditions.push(eq(orders.organizationId, organizationId))
  }

  // Apply branch filter (if explicitly selected)
  if (branchId) {
    yearConditions.push(eq(orders.branchId, branchId))
  }

  // Apply group filter
  if (groupId) {
    yearConditions.push(eq(branches.groupId, groupId))
  }

  // Query monthly sales for the year based on fulfilledAt date
  // Convert fulfilledAt to Pakistan timezone (Asia/Karachi, UTC+5) before extracting month
  // This ensures orders fulfilled on Tuesday in Pakistan are counted in the correct month
  const monthlySalesRows = await db
    .select({
      monthNum: sql<number>`EXTRACT(MONTH FROM (${orders.fulfilledAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')::int`,
      month: sql<string>`TO_CHAR((${orders.fulfilledAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'Mon')`,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      orderCount: sql<number>`coalesce(count(${orders.id}), 0)`,
    })
    .from(orders)
    .leftJoin(branches, eq(orders.branchId, branches.id))
    .where(and(...(yearConditions as any)))
    .groupBy(sql`1,2`)
    .orderBy(sql`1`)

  // Create a map of month -> sales
  const salesMap: Record<string, { sales: number; orderCount: number }> = {}
  for (const row of monthlySalesRows) {
    const monthKey = row.month
    salesMap[monthKey] = {
      sales: (row.totalCents || 0) / 100, // Convert cents to PKR
      orderCount: Number(row.orderCount || 0),
    }
  }

  // Generate all months of the year (Jan to Dec)
  const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const monthlyData = monthsOrder.map(month => ({
    month,
    sales: salesMap[month]?.sales || 0,
    orderCount: salesMap[month]?.orderCount || 0,
  }))

  return ok({
    year,
    monthlySales: monthlyData,
    totalSales: monthlyData.reduce((sum, month) => sum + month.sales, 0),
    totalOrders: monthlyData.reduce((sum, month) => sum + month.orderCount, 0),
  })
}

