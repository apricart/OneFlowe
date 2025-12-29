import { NextRequest } from "next/server"
import { and, eq, gte, sql, or, lt } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const

type Role = typeof allowedRoles[number]

/**
 * Get the start of the current week (Monday) and end of the week (Sunday)
 */
function getCurrentWeekRange() {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Convert Sunday (0) to 6 days back
  
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysToMonday)
  monday.setHours(0, 0, 0, 0)
  
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  nextMonday.setHours(0, 0, 0, 0)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  
  return { monday, sunday, nextMonday }
}

export async function GET(req: NextRequest) {
  const err = await requireApiRole(allowedRoles as any)
  if (err) return err

  const scope = await getRequestScope()
  const role = scope?.role
  
  // Get filter parameters from query string (for UI context selection)
  const { searchParams } = new URL(req.url)
  const orgIdParam = searchParams.get("organizationId")
  const branchIdParam = searchParams.get("branchId")
  
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

  const { monday, sunday, nextMonday } = getCurrentWeekRange()

  // Build conditions for weekly sales
  // Only include APPROVED or FULFILLED orders (exclude PENDING, REJECTED, REFUNDED)
  const weekConditions: any[] = [
    gte(orders.createdAt, monday),
    lt(orders.createdAt, nextMonday),
    or(
      eq(orders.status, "APPROVED"),
      eq(orders.status, "approved"),
      eq(orders.status, "FULFILLED"),
      eq(orders.status, "fulfilled")
    ),
  ]

  // Apply organization filter (if not SUPER_ADMIN or if explicitly selected)
  if (organizationId) {
    weekConditions.push(eq(orders.organizationId, organizationId))
  }

  // Apply branch filter (if explicitly selected)
  if (branchId) {
    weekConditions.push(eq(orders.branchId, branchId))
  }

  // Query daily sales for the current week
  const dayExpr = sql`date_trunc('day', ${orders.createdAt})`
  const weeklySalesRows = await db
    .select({
      day: dayExpr,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      orderCount: sql<number>`coalesce(count(${orders.id}), 0)`,
    })
    .from(orders)
    .where(and(...(weekConditions as any)))
    .groupBy(dayExpr)
    .orderBy(dayExpr)

  // Create a map of day -> sales
  const salesMap: Record<string, { sales: number; orderCount: number }> = {}
  for (const row of weeklySalesRows) {
    const dayKey = new Date(row.day as any).toISOString().slice(0, 10)
    salesMap[dayKey] = {
      sales: (row.totalCents || 0) / 100, // Convert cents to PKR
      orderCount: Number(row.orderCount || 0),
    }
  }

  // Generate all days of the week (Monday to Sunday)
  const weekDays = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const dayKey = day.toISOString().slice(0, 10)
    const dayName = day.toLocaleDateString("en-US", { weekday: "short" })
    
    weekDays.push({
      day: dayName,
      date: dayKey,
      sales: salesMap[dayKey]?.sales || 0,
      orderCount: salesMap[dayKey]?.orderCount || 0,
    })
  }

  return ok({
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
    dailySales: weekDays,
    totalSales: weekDays.reduce((sum, day) => sum + day.sales, 0),
    totalOrders: weekDays.reduce((sum, day) => sum + day.orderCount, 0),
  })
}

