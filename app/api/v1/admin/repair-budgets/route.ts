import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin } from "@/lib/db"
import { budgets, orders, branches, budgetAddons } from "@/db/schema"
import { and, eq, sql, inArray } from "drizzle-orm"

/**
 * POST /api/v1/admin/repair-budgets
 * 
 * Repair corrupted budget data by:
 * 1. Deleting all existing budget records for the given branch(es)
 * 2. Recalculating spent/held amounts from actual order records
 * 3. Recreating clean budget records per month
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { branchId, organizationId, mode = "reset" } = body

    if (!branchId && !organizationId) {
      return NextResponse.json({ error: "branchId or organizationId required" }, { status: 400 })
    }

    const result = await withSuperAdmin(async (tx: any) => {
      // 1. Find target branches
      let targetBranchIds: number[] = []
      
      if (branchId) {
        targetBranchIds = [Number(branchId)]
      } else if (organizationId) {
        const orgBranches = await tx.select({ id: branches.id })
          .from(branches)
          .where(eq(branches.organizationId, Number(organizationId)))
        targetBranchIds = orgBranches.map((b: any) => b.id)
      }

      if (targetBranchIds.length === 0) throw new Error("No branches found")

      // 2. Delete all existing budget addon records for these branches
      const existingBudgets = await tx.select({ id: budgets.id })
        .from(budgets)
        .where(inArray(budgets.branchId, targetBranchIds))
      
      const budgetIds = existingBudgets.map((b: any) => b.id)
      
      let addonsDeleted = 0
      if (budgetIds.length > 0) {
        await tx.delete(budgetAddons).where(inArray(budgetAddons.budgetId, budgetIds))
        addonsDeleted = budgetIds.length
      }

      // 3. Delete all existing budget records
      await tx.delete(budgets).where(inArray(budgets.branchId, targetBranchIds))
      const budgetsDeleted = existingBudgets.length

      if (mode === "reset") {
        return {
          message: "Budget data reset successfully",
          budgetsDeleted,
          addonsDeleted,
          branchIds: targetBranchIds
        }
      }

      // 4. Recalculate from orders
      const orderSpending = await tx
        .select({
          branchId: orders.branchId,
          organizationId: orders.organizationId,
          period: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
          totalSpentCents: sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END), 0)`.mapWith(Number),
          totalHeldCents: sql<number>`COALESCE(SUM(CASE WHEN UPPER(${orders.status}) IN ('PENDING', 'APPROVED') THEN ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END), 0)`.mapWith(Number),
        })
        .from(orders)
        .where(inArray(orders.branchId, targetBranchIds))
        .groupBy(orders.branchId, orders.organizationId, sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)

      // 5. Get branch baselines
      const branchData = await tx.select({
        id: branches.id,
        organizationId: branches.organizationId,
        baselineBudgetCents: branches.baselineBudgetCents,
      }).from(branches).where(inArray(branches.id, targetBranchIds))

      const branchMap = new Map<number, any>(branchData.map((b: any) => [b.id, b]))

      // 6. Create new budget records
      let budgetsCreated = 0
      const currentMonth = new Date().toISOString().slice(0, 7)

      for (const row of orderSpending) {
        const branch = branchMap.get(row.branchId)
        if (!branch) continue

        const isCurrentMonth = row.period === currentMonth
        const allocated = isCurrentMonth ? (branch.baselineBudgetCents || 0) : 0

        await tx.insert(budgets).values({
          organizationId: branch.organizationId,
          branchId: row.branchId,
          period: row.period,
          amountAllocatedCents: allocated,
          amountSpentCents: row.totalSpentCents,
          amountHeldCents: row.totalHeldCents,
          amountCreditedCents: 0,
        }).onConflictDoNothing()

        budgetsCreated++
      }

      // Also create current month record for branches that have no orders this month
      for (const branch of branchData) {
        const hasCurrentMonth = orderSpending.some(
          (r: any) => r.branchId === branch.id && r.period === currentMonth
        )
        if (!hasCurrentMonth) {
          await tx.insert(budgets).values({
            organizationId: branch.organizationId,
            branchId: branch.id,
            period: currentMonth,
            amountAllocatedCents: 0,
            amountSpentCents: 0,
            amountHeldCents: 0,
            amountCreditedCents: 0,
          }).onConflictDoNothing()
          budgetsCreated++
        }
      }

      return {
        message: "Budget data recalculated successfully",
        budgetsDeleted,
        addonsDeleted,
        budgetsCreated,
        branchIds: targetBranchIds
      }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error("[REPAIR] Error:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}

