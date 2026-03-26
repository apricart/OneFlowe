import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets, branches, auditLogs, budgetAddons, groups } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"
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
    const periodParam = searchParams.get("period")
    const groupIdsParam = searchParams.get("groupIds")
    const branchIdsParam = searchParams.get("branchIds")

    // Validate organization ID from session
    if (orgId && !/^\d+$/.test(String(orgId))) {
      console.error('[Budgets] Invalid organizationId in session')
      return NextResponse.json({ error: "Invalid session data" }, { status: 400 })
    }

    // For SUPER_ADMIN using context selector, accept organizationId from query param
    // HEAD_OFFICE must always be scoped to their own organization
    if (orgIdParam && role === "SUPER_ADMIN") {
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
        const currentMonth = periodParam && /^\d{4}-\d{2}$/.test(periodParam) 
            ? periodParam 
            : new Date().toISOString().slice(0, 7) // YYYY-MM format

        const parsedGroupIds = groupIdsParam ? groupIdsParam.split(',').map(Number).filter(id => !isNaN(id)) : []
        const parsedBranchIds = branchIdsParam ? branchIdsParam.split(',').map(Number).filter(id => !isNaN(id)) : []

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
            groupId: branches.groupId,
            groupName: groups.name,
            amountAllocatedCents: budgets.amountAllocatedCents,
            amountSpentCents: budgets.amountSpentCents,
            amountHeldCents: budgets.amountHeldCents,
            amountCreditedCents: budgets.amountCreditedCents,
            baselineBudgetCents: branches.baselineBudgetCents,
          })
          .from(branches)
          .leftJoin(groups, eq(branches.groupId, groups.id))
          .leftJoin(
            budgets,
            and(eq(budgets.branchId, branches.id), eq(budgets.period, currentMonth))
          )
          // SUPER_ADMIN: if an organizationId is provided (via context), scope to it; otherwise, global
          // HEAD_OFFICE: always scoped to their organization
          // Only show active branches (inactive/soft-deleted branches are hidden from budget management)
          .where(
            and(
              eq(branches.status, 'active'),
              role === "SUPER_ADMIN"
                ? orgId
                  ? eq(branches.organizationId, orgId)
                  : undefined
                : eq(branches.organizationId, orgId),
              parsedGroupIds.length > 0 ? inArray(branches.groupId, parsedGroupIds) : undefined,
              parsedBranchIds.length > 0 ? inArray(branches.id, parsedBranchIds) : undefined
            )
          )

        // Identify branches missing a budget for the current month and auto-initialize them
        const missingBudgets = allBranches.filter(b => b.amountAllocatedCents === null)
        
        if (missingBudgets.length > 0) {
          console.log(`[Budgets] Auto-initializing ${missingBudgets.length} missing budgets for ${currentMonth} using baselines`)
          const newRecords = missingBudgets.map(b => ({
            organizationId: b.organizationId,
            branchId: b.branchId,
            period: currentMonth,
            amountAllocatedCents: b.baselineBudgetCents || 0, // Automatically becomes the monthly base
            amountSpentCents: 0,
            amountHeldCents: 0,
            amountCreditedCents: 0,
          }))

          await db.insert(budgets).values(newRecords).onConflictDoNothing()
          
          // Instead of recursing, we manually merge the results
          const newRecordsMap = new Map(newRecords.map(r => [r.branchId, r]))
          
          const finalBudgets = allBranches.map(b => {
            const record = b.amountAllocatedCents !== null ? b : newRecordsMap.get(b.branchId)
            const allocated = record ? (record.amountAllocatedCents ?? b.baselineBudgetCents ?? 0) : (b.baselineBudgetCents ?? 0)
            const credited = (record as any)?.amountCreditedCents || 0
            const spent = (record as any)?.amountSpentCents || 0
            const held = (record as any)?.amountHeldCents || 0
            
            return {
              ...b,
              amountAllocatedCents: allocated,
              amountSpentCents: spent,
              amountHeldCents: held,
              amountCreditedCents: credited,
              remainingCents: (allocated + credited) - (spent + held),
            }
          })

          return NextResponse.json({ budgets: finalBudgets })
        }

        const budgetsWithRemaining = allBranches.map(b => {
          const allocated = b.amountAllocatedCents !== null ? b.amountAllocatedCents : (b.baselineBudgetCents || 0)
          const credited = b.amountCreditedCents || 0
          const spent = b.amountSpentCents || 0
          const held = b.amountHeldCents || 0
          
          return {
            ...b,
            amountAllocatedCents: allocated,
            amountSpentCents: spent,
            amountHeldCents: held,
            amountCreditedCents: credited,
            remainingCents: (allocated + credited) - (spent + held),
          }
        })

        return NextResponse.json({ budgets: budgetsWithRemaining })
      } catch (err: any) {
        logError(err, 'BUDGETS_GET_ALL')
        return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 })
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
    let [b] = await db.select({
      id: budgets.id,
      organizationId: budgets.organizationId,
      branchId: budgets.branchId,
      period: budgets.period,
      amountAllocatedCents: budgets.amountAllocatedCents,
      amountSpentCents: budgets.amountSpentCents,
      amountHeldCents: budgets.amountHeldCents,
      amountCreditedCents: budgets.amountCreditedCents,
      createdAt: budgets.createdAt,
      updatedAt: budgets.updatedAt,
      baselineBudgetCents: branches.baselineBudgetCents,
      orgIdFromBranch: branches.organizationId
    })
      .from(budgets)
      .rightJoin(branches, and(eq(budgets.branchId, branches.id), eq(budgets.period, currentMonth)))
      .where(eq(branches.id, branchId))
      .limit(1) as any[]

    // If no budget record exists for current month, auto-initialize it using branch baseline
    if (!b || b.amountAllocatedCents === null) {
      console.log(`[Budgets] Auto-initializing budget for branch ${branchId} for period ${currentMonth}`)
      
      const [branchRecord] = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1)
      if (!branchRecord) {
        return NextResponse.json({ error: "Branch not found" }, { status: 404 })
      }

      const newBudget = {
        organizationId: branchRecord.organizationId,
        branchId: branchId,
        period: currentMonth,
        amountAllocatedCents: branchRecord.baselineBudgetCents || 0,
        amountSpentCents: 0,
        amountHeldCents: 0,
        amountCreditedCents: 0,
      }

      const [inserted] = await db.insert(budgets).values(newBudget).onConflictDoNothing().returning()
      
      // Use the newly created/found budget
      b = {
        ...newBudget,
        id: inserted?.id || 0,
        createdAt: inserted?.createdAt || new Date(),
        updatedAt: inserted?.updatedAt || new Date(),
        baselineBudgetCents: branchRecord.baselineBudgetCents,
        orgIdFromBranch: branchRecord.organizationId
      } as any
    }

    const allocated = b.amountAllocatedCents ?? 0
    const spent = b.amountSpentCents ?? 0
    const held = b.amountHeldCents ?? 0
    const credited = b.amountCreditedCents ?? 0

    const remainingCents = (allocated + credited) - (spent + held)

    return NextResponse.json({
      branchId,
      amountAllocatedCents: allocated,
      amountSpentCents: spent,
      amountHeldCents: held,
      amountCreditedCents: credited,
      remainingCents,
      baselineBudgetCents: b.baselineBudgetCents || 0,
      period: b.period || currentMonth,
    })
  } catch (e: any) {
    logError(e, 'BUDGETS_GET')
    logError(e, 'BUDGETS_GET')
    const { status, ...errorBody } = handleError(e, 'BUDGETS_GET')
    return NextResponse.json(errorBody, { status })
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

    const { branchId, amountAllocatedCents, setAbsolute, resetAddons, type = "addon" } = body as {
      branchId: number;
      amountAllocatedCents: number;
      type?: "addon" | "monthly";
      setAbsolute?: boolean;
      resetAddons?: boolean;
    }
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

    if (type === "monthly") {
      // Update baseline on the branch record
      await db.update(branches)
        .set({
          baselineBudgetCents: amountAllocatedCents,
          updatedAt: new Date(),
        })
        .where(eq(branches.id, branchId))

      // If budget record exists for current month, we might want to reconcile it
      // For simplicity, if it exists, we update it IF it was just using the old baseline
      if (budget) {
        await db.update(budgets)
          .set({
            amountAllocatedCents,
            updatedAt: new Date(),
          })
          .where(and(eq(budgets.branchId, branchId), eq(budgets.period, currentMonth)))
      } else {
        // Create it if it doesn't exist
        await db.insert(budgets).values({
          organizationId: branch.organizationId,
          branchId,
          period: currentMonth,
          amountAllocatedCents,
          amountSpentCents: 0,
          amountHeldCents: 0,
          amountCreditedCents: 0,
        })
      }

      // Log action
      try {
        await db.insert(auditLogs).values({
          userId,
          organizationId: branch.organizationId,
          action: "UPDATE_BRANCH_BASELINE",
          entity: "BRANCH",
          entityId: String(branchId),
          metadata: {
            branchName: branch.name,
            oldBaseline: (branch.baselineBudgetCents || 0) / 100,
            newBaseline: amountAllocatedCents / 100,
          },
        })
      } catch (auditError) {
        logError(auditError, 'BUDGETS_AUDIT_LOG')
      }

      return NextResponse.json({
        message: "Baseline budget updated successfully",
        baseline: amountAllocatedCents / 100
      })
    }

    // Default 'addon' or 'adjustment' logic
    let newAllocated: number
    let newCredited: number
    const oldAmount = budget?.amountAllocatedCents ?? branch.baselineBudgetCents ?? 0
    const oldCredited = budget?.amountCreditedCents ?? 0

    if (type === "addon") {
      newAllocated = oldAmount
      newCredited = resetAddons ? 0 : oldCredited + amountAllocatedCents
    } else if (setAbsolute) {
      newAllocated = amountAllocatedCents
      newCredited = resetAddons ? 0 : oldCredited
    } else {
      newAllocated = oldAmount + amountAllocatedCents
      newCredited = resetAddons ? 0 : oldCredited
    }

    // SYNC: Also update the permanent branch baseline if we are setting an absolute value (e.g. Emptying/Wiping)
    if (setAbsolute) {
      await db.update(branches)
        .set({
          baselineBudgetCents: newAllocated,
          updatedAt: new Date(),
        })
        .where(eq(branches.id, branchId))
    }

    // Prevent negative budgets
    if (newAllocated < 0) {
      return NextResponse.json({
        error: `Base budget cannot be negative. Attempted value: ${(newAllocated / 100).toFixed(2)} PKR`
      }, { status: 400 })
    }

    console.log(`[BUDGETS] Processing PUT request for branchId: ${branchId}, amount: ${amountAllocatedCents / 100} PKR, type: ${type}`)

    // Use UPSERT for maximum reliability
    const upsertResult = await db.insert(budgets)
      .values({
        organizationId: branch.organizationId,
        branchId,
        period: currentMonth,
        amountAllocatedCents: newAllocated,
        amountCreditedCents: newCredited,
        amountSpentCents: budget?.amountSpentCents ?? 0,
        amountHeldCents: budget?.amountHeldCents ?? 0,
      })
      .onConflictDoUpdate({
        target: [budgets.branchId, budgets.period],
        set: {
          amountAllocatedCents: newAllocated,
          amountCreditedCents: newCredited,
          updatedAt: new Date(),
        }
      })
      .returning()

    const finalRecord = upsertResult[0]

    // Record addon transaction if needed
    if (type === "addon" && finalRecord) {
      await db.insert(budgetAddons).values({
        budgetId: finalRecord.id,
        amountCents: amountAllocatedCents,
        reason: body.reason || "Monthly Add-on Credit",
        createdByUserId: userId,
      })
    }

    console.log(`[BUDGETS] Successfully upserted budget record for branch: ${branchId}`)

    // Log action
    try {
      await db.insert(auditLogs).values({
        userId,
        organizationId: branch.organizationId,
        action: setAbsolute ? "SET_BUDGET_ALLOCATION" : (type === "addon" ? "ADD_CREDIT" : "UPDATE_BUDGET_ALLOCATION"),
        entity: "BUDGET",
        entityId: String(branchId),
        metadata: {
          branchName: branch.name,
          period: currentMonth,
          oldAmount: oldAmount / 100,
          newAmount: newAllocated / 100,
          addedAmount: type === "addon" ? amountAllocatedCents / 100 : undefined,
          wasReset: newAllocated === 0
        },
      })
    } catch (auditError) {
      logError(auditError, 'BUDGETS_AUDIT_LOG')
    }

    return NextResponse.json({
      message: type === "addon" ? "Add-on credited successfully" : (newAllocated === 0 ? "Budget emptied successfully" : "Budget updated successfully"),
      budget: {
        branchId,
        branchName: branch.name,
        period: currentMonth,
        oldAmount: oldAmount / 100,
        newAmount: newAllocated / 100,
        newCredited: newCredited / 100,
        wasReset: newAllocated === 0
      }
    })
  } catch (e: any) {
    logError(e, 'BUDGETS_PUT')
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

