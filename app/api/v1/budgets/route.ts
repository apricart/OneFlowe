import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets, branches, auditLogs } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { handleError } from "@/lib/error-handler"
import { logError } from "@/lib/global-logger"

/**
 * Validate numeric ID parameter
 */
function validateNumericId(value: string | undefined | null, paramName: string): number | null {
  if (!value) return null

  if (!/^\d+$/.test(value)) {
    console.warn(`[Budgets] Invalid ${paramName}: ${value}`)
    return null
  }

  const num = parseInt(value, 10)
  if (isNaN(num) || num <= 0) {
    console.warn(`[Budgets] ${paramName} out of range: ${num}`)
    return null
  }

  return num
}

/**
 * GET /api/v1/budgets - Fetch budget information
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    let orgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId

    const { searchParams } = new URL(req.url)
    const allParam = searchParams.get("all")
    const branchIdParam = searchParams.get("branchId")
    const orgIdParam = searchParams.get("organizationId")

    // Validate organization ID from session
    if (orgId && !/^\d+$/.test(String(orgId))) {
      console.error('[Budgets] Invalid organizationId in session')
      return NextResponse.json({ error: "Invalid session data" }, { status: 400 })
    }

    // For admin users using context selector, accept organizationId from query param
    if (orgIdParam && (role === "HEAD_OFFICE" || role === "SUPER_ADMIN")) {
      const parsedOrgId = validateNumericId(orgIdParam, "organizationId")
      if (parsedOrgId) {
        orgId = parsedOrgId
      } else {
        return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
      }
    }

    // Head Office users can fetch all budgets in their org
    if (allParam && (role === "HEAD_OFFICE" || role === "SUPER_ADMIN")) {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

        // Validate organization context for HEAD_OFFICE
        if (role === "HEAD_OFFICE" && !orgId) {
          return NextResponse.json({
            error: "Organization context required for HEAD_OFFICE users"
          }, { status: 400 })
        }

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
        logError(err, 'BUDGETS_GET_ALL')
        return NextResponse.json({ error: err.message || "Failed to fetch budgets" }, { status: 500 })
      }
    }

    // Single branch budget query - must be for current month period
    const branchId = (role === "HEAD_OFFICE" || role === "SUPER_ADMIN") && branchIdParam
      ? validateNumericId(branchIdParam, "branchId")
      : validateNumericId(String(userBranchId), "branchId")

    if (!branchId) {
      return NextResponse.json({ error: "Valid branch ID required" }, { status: 400 })
    }

    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const [b] = await db.select().from(budgets).where(
      and(
        eq(budgets.branchId, branchId),
        eq(budgets.period, currentMonth)
      )
    ).limit(1)

    if (!b) {
      return NextResponse.json({
        error: `Budget not configured for current month (${currentMonth})`,
        branchId,
        period: currentMonth
      }, { status: 404 })
    }

    const remainingCents = (b.amountAllocatedCents + b.amountCreditedCents) - (b.amountSpentCents + b.amountHeldCents)

    return NextResponse.json({
      branchId,
      amountAllocatedCents: b.amountAllocatedCents,
      amountSpentCents: b.amountSpentCents,
      amountHeldCents: b.amountHeldCents,
      amountCreditedCents: b.amountCreditedCents,
      remainingCents,
      period: b.period,
    })
  } catch (e: any) {
    logError(e, 'BUDGETS_GET')
    return handleError(e, 'BUDGETS_GET')
  }
}

/**
 * PUT /api/v1/budgets - Update or create budget allocation
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    const userId = (session.user as any).id
    const orgId = (session.user as any).organizationId

    // Only Head Office and Super Admin can update budgets
    if (role !== "HEAD_OFFICE" && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    let body
    try {
      body = await req.json()
    } catch (jsonError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { branchId, amountAllocatedCents } = body

    // Validate required fields
    if (!branchId) {
      return NextResponse.json({ error: "branchId is required" }, { status: 400 })
    }

    if (amountAllocatedCents === undefined || amountAllocatedCents === null) {
      return NextResponse.json({ error: "amountAllocatedCents is required" }, { status: 400 })
    }

    // Validate types
    if (typeof branchId !== 'number' || branchId <= 0) {
      return NextResponse.json({ error: "branchId must be a positive number" }, { status: 400 })
    }

    if (!Number.isFinite(amountAllocatedCents) || amountAllocatedCents < 0) {
      return NextResponse.json({ error: "Amount must be a non-negative finite number" }, { status: 400 })
    }

    // Additional safety check for extremely large values
    if (amountAllocatedCents > Number.MAX_SAFE_INTEGER / 2) {
      return NextResponse.json({ error: "Amount exceeds maximum allowed value" }, { status: 400 })
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

    // HEAD_OFFICE users can only update budgets for their own organization
    if (role === "HEAD_OFFICE" && branch.organizationId !== orgId) {
      return NextResponse.json({
        error: "Unauthorized: Branch belongs to different organization"
      }, { status: 403 })
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
      const newAmount = oldAmount + amountAllocatedCents // ADD to existing budget

      // Prevent negative budgets
      if (newAmount < 0) {
        return NextResponse.json({
          error: `Cannot reduce budget below zero. Current: ${(oldAmount / 100).toFixed(2)} PKR, Attempted reduction: ${(Math.abs(amountAllocatedCents) / 100).toFixed(2)} PKR`
        }, { status: 400 })
      }

      await db.update(budgets).set({
        amountAllocatedCents: newAmount,
        updatedAt: new Date(),
      }).where(and(eq(budgets.branchId, branchId), eq(budgets.period, currentMonth)))

      // Log action
      try {
        await db.insert(auditLogs).values({
          userId,
          organizationId: branch.organizationId,
          action: "UPDATE_BUDGET_ALLOCATION",
          entity: "BUDGET",
          entityId: String(branchId),
          metadata: {
            branchName: branch.name,
            period: currentMonth,
            oldAmount: oldAmount / 100,
            addedAmount: amountAllocatedCents / 100,
            newAmount: newAmount / 100,
          },
        })
      } catch (auditError) {
        // Log but don't fail the request
        logError(auditError, 'BUDGETS_AUDIT_LOG')
      }

      return NextResponse.json({
        message: "Budget updated successfully",
        budget: {
          branchId,
          branchName: branch.name,
          period: currentMonth,
          oldAmount: oldAmount / 100,
          addedAmount: amountAllocatedCents / 100,
          newAmount: newAmount / 100
        }
      })
    } else {
      // Create new budget record for current period
      // Cannot create with negative initial allocation
      if (amountAllocatedCents < 0) {
        return NextResponse.json({
          error: "Cannot create budget with negative allocation"
        }, { status: 400 })
      }

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
      try {
        await db.insert(auditLogs).values({
          userId,
          organizationId: branch.organizationId,
          action: "CREATE_BUDGET_ALLOCATION",
          entity: "BUDGET",
          entityId: String(branchId),
          metadata: {
            branchName: branch.name,
            amount: amountAllocatedCents / 100,
            period: currentMonth,
          },
        })
      } catch (auditError) {
        // Log but don't fail the request
        logError(auditError, 'BUDGETS_AUDIT_LOG')
      }

      return NextResponse.json({
        message: "Budget created successfully",
        budget: {
          branchId,
          branchName: branch.name,
          period: currentMonth,
          amount: amountAllocatedCents / 100
        }
      })
    }
  } catch (e: any) {
    logError(e, 'BUDGETS_PUT')
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
  }
}

