import { NextRequest } from "next/server"
import { and, eq, gte, sql, or, lt } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders } from "@/db/schema"
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
  
  // Use query params if provided, otherwise fall back to auth scope
  let organizationId: number | null = null
  let branchId: number | null = null
  
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

  // Get year from query param or use current year
  const currentYear = new Date().getFullYear()
  const year = yearParam ? Number(yearParam) : currentYear
  
  // Calculate start and end of the year
  const yearStart = new Date(year, 0, 1) // January 1st
  yearStart.setHours(0, 0, 0, 0)
  const yearEnd = new Date(year, 11, 31) // December 31st
  yearEnd.setHours(23, 59, 59, 999)
  const nextYearStart = new Date(year + 1, 0, 1)
  nextYearStart.setHours(0, 0, 0, 0)

  // Build conditions for yearly sales
  // Only include FULFILLED orders with fulfilledAt date (exclude PENDING, REJECTED, REFUNDED)
  const yearConditions: any[] = [
    sql`${orders.fulfilledAt} IS NOT NULL`,
    gte(orders.fulfilledAt, yearStart),
    lt(orders.fulfilledAt, nextYearStart),
    or(
      eq(orders.status, "FULFILLED"),
      eq(orders.status, "fulfilled")
    ),
  ]

  // Apply organization filter (if not SUPER_ADMIN or if explicitly selected)
  if (organizationId) {
    yearConditions.push(eq(orders.organizationId, organizationId))
  }

  // Apply branch filter (if explicitly selected)
  if (branchId) {
    yearConditions.push(eq(orders.branchId, branchId))
  }

  // Query monthly sales for the year based on fulfilledAt date
  const monthlySalesRows = await db
    .select({
      monthNum: sql<number>`EXTRACT(MONTH FROM ${orders.fulfilledAt})::int`,
      month: sql<string>`TO_CHAR(${orders.fulfilledAt}, 'Mon')`,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      orderCount: sql<number>`coalesce(count(${orders.id}), 0)`,
    })
    .from(orders)
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

