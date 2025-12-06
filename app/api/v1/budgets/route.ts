import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets, branches, auditLogs } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const role = (session.user as any).role
    let orgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId

    const { searchParams } = new URL(req.url)
    const allParam = searchParams.get("all")
    const branchIdParam = searchParams.get("branchId")
    const orgIdParam = searchParams.get("organizationId")

    // For admin users using context selector, accept organizationId from query param
    if (orgIdParam && (role === "HEAD_OFFICE" || role === "SUPER_ADMIN")) {
      const parsedOrgId = parseInt(orgIdParam)
      if (Number.isFinite(parsedOrgId)) {
        orgId = parsedOrgId
      }
    }

    // Head Office users can fetch all budgets in their org
    if (allParam && (role === "HEAD_OFFICE" || role === "SUPER_ADMIN")) {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
        
        // Use LEFT JOIN to get all branches, even if they don't have budgets for current period yet
        const allBranches = await db
          .select({
            branchId: branches.id,
            branchName: branches.name,
            organizationId: branches.organizationId,
            amountAllocatedCents: budgets.amountAllocatedCents,
            amountSpentCents: budgets.amountSpentCents,
            amountHeldCents: budgets.amountHeldCents,
            amountCreditedCents: budgets.amountCreditedCents,
          })
          .from(branches)
          .leftJoin(
            budgets,
            and(eq(budgets.branchId, branches.id), eq(budgets.period, currentMonth))
          )
          // SUPER_ADMIN: if an organizationId is provided (via context), scope to it; otherwise, global
          // HEAD_OFFICE: always scoped to their organization
          .where(
            role === "SUPER_ADMIN"
              ? orgId
                ? eq(branches.organizationId, orgId)
                : undefined
              : eq(branches.organizationId, orgId)
          )

        const budgetsWithRemaining = allBranches.map(b => ({
          ...b,
          amountAllocatedCents: b.amountAllocatedCents || 0,
          amountSpentCents: b.amountSpentCents || 0,
          amountHeldCents: b.amountHeldCents || 0,
          amountCreditedCents: b.amountCreditedCents || 0,
          remainingCents: ((b.amountAllocatedCents || 0) + (b.amountCreditedCents || 0)) - ((b.amountSpentCents || 0) + (b.amountHeldCents || 0)),
        }))

        return NextResponse.json({ budgets: budgetsWithRemaining })
      } catch (err: any) {
        console.error("Error fetching budgets:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
      }
    }

    // Single branch budget query
    const branchId = (role === "HEAD_OFFICE" || role === "SUPER_ADMIN") && branchIdParam
      ? parseInt(branchIdParam)
      : parseInt(userBranchId)

    if (!branchId) return NextResponse.json({ error: "Branch ID required" }, { status: 400 })

    const [b] = await db.select().from(budgets).where(eq(budgets.branchId, branchId)).limit(1)
    if (!b) return NextResponse.json({ error: "Budget not configured" }, { status: 404 })

    const remainingCents = (b.amountAllocatedCents + b.amountCreditedCents) - (b.amountSpentCents + b.amountHeldCents)
    return NextResponse.json({
      branchId,
      amountAllocatedCents: b.amountAllocatedCents,
      amountSpentCents: b.amountSpentCents,
      amountHeldCents: b.amountHeldCents,
      amountCreditedCents: b.amountCreditedCents,
      remainingCents,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const role = (session.user as any).role
    const userId = (session.user as any).id
    const orgId = (session.user as any).organizationId

    // Only Head Office and Super Admin can update budgets
    if (role !== "HEAD_OFFICE" && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await req.json()
    const { branchId, amountAllocatedCents } = body

    if (!branchId || amountAllocatedCents === undefined) {
      return NextResponse.json({ error: "branchId and amountAllocatedCents required" }, { status: 400 })
    }

    if (!Number.isFinite(amountAllocatedCents) || amountAllocatedCents < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    // Verify branch exists and belongs to org
    const [branch] = await db
      .select()
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1)

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    if (role === "HEAD_OFFICE" && branch.organizationId !== orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update or create budget for current period
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const [budget] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.branchId, branchId), eq(budgets.period, currentMonth)))
      .limit(1)

    if (budget) {
      const oldAmount = budget.amountAllocatedCents
      await db.update(budgets).set({
        amountAllocatedCents,
        updatedAt: new Date(),
      }).where(and(eq(budgets.branchId, branchId), eq(budgets.period, currentMonth)))

      // Log action
      await db.insert(auditLogs).values({
        userId,
        organizationId: orgId,
        action: "UPDATE_BUDGET_ALLOCATION",
        entity: "BUDGET",
        entityId: String(branchId),
        metadata: {
          branchName: branch.name,
          oldAmount: oldAmount / 100,
          newAmount: amountAllocatedCents / 100,
        },
      })
    } else {
      // Create new budget record for current period
      await db.insert(budgets).values({
        organizationId: branch.organizationId,
        branchId,
        period: currentMonth,
        amountAllocatedCents,
        amountSpentCents: 0,
        amountHeldCents: 0,
        amountCreditedCents: 0,
      })

      // Log action
      await db.insert(auditLogs).values({
        userId,
        organizationId: orgId,
        action: "CREATE_BUDGET_ALLOCATION",
        entity: "BUDGET",
        entityId: String(branchId),
        metadata: {
          branchName: branch.name,
          amount: amountAllocatedCents / 100,
          period: currentMonth,
        },
      })
    }

    return NextResponse.json({ message: "Budget updated" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


