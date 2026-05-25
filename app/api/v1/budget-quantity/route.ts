import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { getBudgetAllocationModeForOrganization } from "@/lib/server/budget-allocation-mode"
import {
  auditLogs,
  branchInventory,
  branches,
  budgetAddons,
  budgets,
  globalProducts,
  organizationInventory,
  productQuantityBudgetAllocations,
  productQuantityBudgets,
} from "@/db/schema"

type AllocationType = "addon" | "monthly"

interface QuantityAllocationRequestItem {
  branchInventoryId: number
  quantity: number
}

const currentBudgetPeriod = () => new Date().toISOString().slice(0, 7)
const periodPattern = /^\d{4}-\d{2}$/

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0

const parseNumberList = (value: string | null) =>
  value
    ? value.split(",").map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : []

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    const rawUserOrgId = (session.user as any).organizationId
    const userOrgId = Number.isFinite(Number(rawUserOrgId)) ? Number(rawUserOrgId) : undefined

    if (role !== "HEAD_OFFICE" && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (role === "HEAD_OFFICE" && !userOrgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const requestedOrgId = Number(searchParams.get("organizationId"))
    const periodParam = searchParams.get("period")
    const period = periodParam && periodPattern.test(periodParam)
      ? periodParam
      : currentBudgetPeriod()

    if (searchParams.get("organizationId") && (!Number.isInteger(requestedOrgId) || requestedOrgId <= 0)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
    }

    const scopedOrganizationId = role === "HEAD_OFFICE"
      ? userOrgId
      : Number.isInteger(requestedOrgId) && requestedOrgId > 0
        ? requestedOrgId
        : undefined

    if (!scopedOrganizationId) {
      return NextResponse.json({ error: "Select an organization to view quantity budgets" }, { status: 400 })
    }

    const budgetAllocationMode = await getBudgetAllocationModeForOrganization(scopedOrganizationId)
    if (budgetAllocationMode !== "quantity") {
      return NextResponse.json({ error: "This organization uses money-value budgeting" }, { status: 403 })
    }

    const groupIds = parseNumberList(searchParams.get("groupIds"))
    const branchIds = parseNumberList(searchParams.get("branchIds"))

    const quantityRows = await db
      .select({
        quantityBudgetId: productQuantityBudgets.id,
        organizationId: productQuantityBudgets.organizationId,
        branchId: productQuantityBudgets.branchId,
        organizationInventoryId: productQuantityBudgets.organizationInventoryId,
        globalProductId: productQuantityBudgets.globalProductId,
        productCode: globalProducts.productCode,
        globalProductName: globalProducts.name,
        customName: organizationInventory.customName,
        unit: globalProducts.unit,
        baseQuantity: productQuantityBudgets.allocatedQuantity,
        addonQuantity: productQuantityBudgets.creditedQuantity,
        heldQuantity: productQuantityBudgets.heldQuantity,
        usedQuantity: productQuantityBudgets.usedQuantity,
      })
      .from(productQuantityBudgets)
      .innerJoin(
        branches,
        and(
          eq(productQuantityBudgets.branchId, branches.id),
          eq(productQuantityBudgets.organizationId, branches.organizationId),
        )
      )
      .leftJoin(organizationInventory, eq(productQuantityBudgets.organizationInventoryId, organizationInventory.id))
      .leftJoin(globalProducts, eq(productQuantityBudgets.globalProductId, globalProducts.id))
      .where(and(
        eq(productQuantityBudgets.period, period),
        eq(branches.status, "active"),
        scopedOrganizationId ? eq(productQuantityBudgets.organizationId, scopedOrganizationId) : undefined,
        groupIds.length > 0 ? inArray(branches.groupId, groupIds) : undefined,
        branchIds.length > 0 ? inArray(productQuantityBudgets.branchId, branchIds) : undefined,
      ))

    const products = quantityRows.map((row) => {
      const totalQuantity = row.baseQuantity + row.addonQuantity
      const spentQuantity = row.usedQuantity + row.heldQuantity

      return {
        quantityBudgetId: row.quantityBudgetId,
        organizationId: row.organizationId,
        branchId: row.branchId,
        organizationInventoryId: row.organizationInventoryId,
        globalProductId: row.globalProductId,
        productCode: row.productCode,
        productName: row.customName || row.globalProductName || `Product ${row.globalProductId}`,
        unit: row.unit,
        baseQuantity: row.baseQuantity,
        addonQuantity: row.addonQuantity,
        totalQuantity,
        spentQuantity,
        remainingQuantity: totalQuantity - spentQuantity,
      }
    })

    const branchSummaryById = new Map<number, {
      branchId: number
      baseQuantity: number
      addonQuantity: number
      totalQuantity: number
      spentQuantity: number
      remainingQuantity: number
      productCount: number
    }>()

    for (const product of products) {
      const summary = branchSummaryById.get(product.branchId) || {
        branchId: product.branchId,
        baseQuantity: 0,
        addonQuantity: 0,
        totalQuantity: 0,
        spentQuantity: 0,
        remainingQuantity: 0,
        productCount: 0,
      }

      summary.baseQuantity += product.baseQuantity
      summary.addonQuantity += product.addonQuantity
      summary.totalQuantity += product.totalQuantity
      summary.spentQuantity += product.spentQuantity
      summary.remainingQuantity += product.remainingQuantity
      summary.productCount += 1
      branchSummaryById.set(product.branchId, summary)
    }

    return NextResponse.json({
      period,
      branches: Array.from(branchSummaryById.values()),
      products,
    })
  } catch (error: any) {
    console.error("[BudgetQuantity] Quantity summary fetch failed:", error)
    return NextResponse.json({ error: "Failed to fetch quantity budgets" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    const userId = (session.user as any).id
    const rawUserOrgId = (session.user as any).organizationId
    const userOrgId = Number.isFinite(Number(rawUserOrgId)) ? Number(rawUserOrgId) : undefined

    if (role !== "HEAD_OFFICE" && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let body: {
      branchId?: number
      type?: AllocationType
      items?: QuantityAllocationRequestItem[]
      reason?: string
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const branchId = Number(body.branchId)
    const type: AllocationType = body.type === "monthly" ? "monthly" : "addon"
    const items = body.items || []

    if (!Number.isInteger(branchId) || branchId <= 0) {
      return NextResponse.json({ error: "branchId must be a positive number" }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one product quantity allocation is required" }, { status: 400 })
    }

    if (items.length > 100) {
      return NextResponse.json({ error: "Too many allocation lines in one request" }, { status: 400 })
    }

    for (const item of items) {
      if (!isPositiveInteger(item.branchInventoryId)) {
        return NextResponse.json({ error: "Each item requires a valid branchInventoryId" }, { status: 400 })
      }
      if (!isPositiveInteger(item.quantity)) {
        return NextResponse.json({ error: "Each quantity must be a positive whole number" }, { status: 400 })
      }
    }

    const branchInventoryIds = items.map((item) => item.branchInventoryId)
    if (new Set(branchInventoryIds).size !== branchInventoryIds.length) {
      return NextResponse.json({ error: "Each product can only appear once in a quantity allocation" }, { status: 400 })
    }

    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1)
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    if (role === "HEAD_OFFICE" && branch.organizationId !== userOrgId) {
      return NextResponse.json({ error: "Unauthorized: Branch belongs to different organization" }, { status: 403 })
    }

    const budgetAllocationMode = await getBudgetAllocationModeForOrganization(branch.organizationId)
    if (budgetAllocationMode !== "quantity") {
      return NextResponse.json({
        error: "This organization uses money-value budgeting. Quantity budget allocation is not available."
      }, { status: 403 })
    }

    const assignedProducts = await db
      .select({
        branchInventoryId: branchInventory.id,
        organizationInventoryId: branchInventory.organizationInventoryId,
        globalProductId: organizationInventory.globalProductId,
        productName: globalProducts.name,
        productCode: globalProducts.productCode,
        customName: organizationInventory.customName,
        customPrice: organizationInventory.customPrice,
        basePrice: globalProducts.basePrice,
        unit: globalProducts.unit,
      })
      .from(branchInventory)
      .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
      .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
      .where(and(
        eq(branchInventory.branchId, branch.id),
        eq(branchInventory.organizationId, branch.organizationId),
        inArray(branchInventory.id, branchInventoryIds),
        eq(branchInventory.isActive, true),
        eq(organizationInventory.isActive, true),
        eq(globalProducts.status, "active"),
        isNull(branchInventory.deletedAt),
        isNull(organizationInventory.deletedAt),
        isNull(globalProducts.deletedAt),
      ))

    if (assignedProducts.length !== branchInventoryIds.length) {
      return NextResponse.json({
        error: "Some selected products are not assigned to this branch or are inactive"
      }, { status: 400 })
    }

    const quantityByBranchInventoryId = new Map(
      items.map((item) => [item.branchInventoryId, item.quantity])
    )

    const allocationLines = assignedProducts.map((product) => {
      const quantity = quantityByBranchInventoryId.get(product.branchInventoryId) || 0
      const priceCents = product.customPrice ?? product.basePrice

      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        throw new Error(`Pricing is unavailable for ${product.customName || product.productName}`)
      }

      return {
        ...product,
        quantity,
        priceCents,
        amountCents: priceCents * quantity,
      }
    })

    const totalAmountCents = allocationLines.reduce((sum, line) => sum + line.amountCents, 0)
    const totalQuantity = allocationLines.reduce((sum, line) => sum + line.quantity, 0)

    if (!Number.isSafeInteger(totalAmountCents) || totalAmountCents < 0) {
      return NextResponse.json({ error: "Calculated allocation amount is invalid" }, { status: 400 })
    }

    if (totalAmountCents > Number.MAX_SAFE_INTEGER / 2) {
      return NextResponse.json({ error: "Allocation amount exceeds maximum allowed value" }, { status: 400 })
    }

    const period = currentBudgetPeriod()

    const result = await db.transaction(async (tx) => {
      const selectedOrganizationInventoryIds = allocationLines.map((line) => line.organizationInventoryId)

      const existingQuantityRows = await tx
        .select()
        .from(productQuantityBudgets)
        .where(and(
          eq(productQuantityBudgets.branchId, branch.id),
          eq(productQuantityBudgets.period, period),
        ))

      const existingQuantityByOrgInvId = new Map(
        existingQuantityRows.map((row) => [row.organizationInventoryId, row])
      )

      const monthlyAmountByOrgInvId = new Map(
        allocationLines.map((line) => [line.organizationInventoryId, line.amountCents])
      )

      const monthlyBaselineAmountCents = type === "monthly"
        ? Array.from(new Set([
          ...existingQuantityRows.map((row) => row.organizationInventoryId),
          ...selectedOrganizationInventoryIds,
        ])).reduce((sum, organizationInventoryId) => {
          const updatedAmount = monthlyAmountByOrgInvId.get(organizationInventoryId)
          if (updatedAmount !== undefined) return sum + updatedAmount

          const existing = existingQuantityByOrgInvId.get(organizationInventoryId)
          return sum + (existing?.amountAllocatedCents || 0)
        }, 0)
        : totalAmountCents

      const [existingBudget] = await tx
        .select()
        .from(budgets)
        .where(and(eq(budgets.branchId, branch.id), eq(budgets.period, period)))
        .limit(1)

      const currentSpent = (existingBudget?.amountSpentCents || 0) + (existingBudget?.amountHeldCents || 0)
      const oldAllocated = existingBudget?.amountAllocatedCents ?? branch.baselineBudgetCents ?? 0
      const oldCredited = existingBudget?.amountCreditedCents ?? 0

      const newAllocated = type === "monthly" ? monthlyBaselineAmountCents : oldAllocated
      const newCredited = type === "addon" ? oldCredited + totalAmountCents : oldCredited
      const proposedTotal = newAllocated + newCredited

      if (proposedTotal < currentSpent) {
        throw new Error(`Validation Failed: Total budget (${(proposedTotal / 100).toFixed(2)} PKR) cannot be less than current total spent (${(currentSpent / 100).toFixed(2)} PKR).`)
      }

      if (type === "monthly") {
        await tx.update(branches)
          .set({ baselineBudgetCents: monthlyBaselineAmountCents, updatedAt: new Date() })
          .where(eq(branches.id, branch.id))
      }

      const [moneyBudget] = await tx
        .insert(budgets)
        .values({
          organizationId: branch.organizationId,
          branchId: branch.id,
          period,
          amountAllocatedCents: newAllocated,
          amountCreditedCents: newCredited,
          amountSpentCents: existingBudget?.amountSpentCents ?? 0,
          amountHeldCents: existingBudget?.amountHeldCents ?? 0,
        })
        .onConflictDoUpdate({
          target: [budgets.branchId, budgets.period],
          set: {
            amountAllocatedCents: newAllocated,
            amountCreditedCents: newCredited,
            updatedAt: new Date(),
          },
        })
        .returning()

      if (type === "addon") {
        await tx.insert(budgetAddons).values({
          budgetId: moneyBudget.id,
          amountCents: totalAmountCents,
          reason: body.reason || "Product quantity budget allocation",
          createdByUserId: userId,
        })
      }

      const quantityBudgetRows = []

      for (const line of allocationLines) {
        const existing = existingQuantityByOrgInvId.get(line.organizationInventoryId)
        const currentUsedOrHeld = (existing?.usedQuantity || 0) + (existing?.heldQuantity || 0)
        const proposedQuantityTotal = type === "monthly"
          ? line.quantity + (existing?.creditedQuantity || 0)
          : (existing?.allocatedQuantity || 0) + (existing?.creditedQuantity || 0) + line.quantity

        if (proposedQuantityTotal < currentUsedOrHeld) {
          throw new Error(`Quantity allocation for ${line.customName || line.productName} cannot be lower than already used or held quantity.`)
        }

        const [quantityBudget] = await tx
          .insert(productQuantityBudgets)
          .values({
            organizationId: branch.organizationId,
            branchId: branch.id,
            organizationInventoryId: line.organizationInventoryId,
            globalProductId: line.globalProductId,
            period,
            allocatedQuantity: type === "monthly" ? line.quantity : 0,
            creditedQuantity: type === "addon" ? line.quantity : 0,
            amountAllocatedCents: type === "monthly" ? line.amountCents : 0,
            amountCreditedCents: type === "addon" ? line.amountCents : 0,
            createdByUserId: userId,
            updatedByUserId: userId,
          })
          .onConflictDoUpdate({
            target: [
              productQuantityBudgets.branchId,
              productQuantityBudgets.organizationInventoryId,
              productQuantityBudgets.period,
            ],
            set: type === "monthly"
              ? {
                allocatedQuantity: line.quantity,
                amountAllocatedCents: line.amountCents,
                globalProductId: line.globalProductId,
                updatedByUserId: userId,
                updatedAt: new Date(),
              }
              : {
                creditedQuantity: sql`${productQuantityBudgets.creditedQuantity} + ${line.quantity}`,
                amountCreditedCents: sql`${productQuantityBudgets.amountCreditedCents} + ${line.amountCents}`,
                globalProductId: line.globalProductId,
                updatedByUserId: userId,
                updatedAt: new Date(),
              },
          })
          .returning()

        await tx.insert(productQuantityBudgetAllocations).values({
          quantityBudgetId: quantityBudget.id,
          budgetId: moneyBudget.id,
          organizationId: branch.organizationId,
          branchId: branch.id,
          organizationInventoryId: line.organizationInventoryId,
          globalProductId: line.globalProductId,
          period,
          allocationType: type,
          quantity: line.quantity,
          priceCents: line.priceCents,
          amountCents: line.amountCents,
          createdByUserId: userId,
          metadata: {
            branchInventoryId: line.branchInventoryId,
            productName: line.customName || line.productName,
            productCode: line.productCode,
            unit: line.unit,
          },
        })

        quantityBudgetRows.push(quantityBudget)
      }

      await tx.insert(auditLogs).values({
        userId,
        organizationId: branch.organizationId,
        branchId: branch.id,
        action: type === "monthly" ? "SET_QUANTITY_BUDGET" : "ADD_QUANTITY_BUDGET_CREDIT",
        entity: "PRODUCT_QUANTITY_BUDGET",
        entityId: String(branch.id),
        metadata: {
          branchName: branch.name,
          period,
          allocationType: type,
          totalQuantity,
          totalAmount: totalAmountCents / 100,
          products: allocationLines.map((line) => ({
            organizationInventoryId: line.organizationInventoryId,
            globalProductId: line.globalProductId,
            productName: line.customName || line.productName,
            quantity: line.quantity,
            price: line.priceCents / 100,
            amount: line.amountCents / 100,
          })),
        },
      })

      return {
        moneyBudget,
        quantityBudgets: quantityBudgetRows,
        totalAmountCents,
        totalQuantity,
      }
    })

    return NextResponse.json({
      message: type === "monthly"
        ? "Quantity baseline allocated successfully"
        : "Quantity add-on allocated successfully",
      allocation: {
        branchId: branch.id,
        branchName: branch.name,
        period,
        type,
        totalQuantity: result.totalQuantity,
        totalAmountCents: result.totalAmountCents,
        productCount: allocationLines.length,
      },
    })
  } catch (error: any) {
    console.error("[BudgetQuantity] Allocation failed:", error)
    const message = error?.message || "Internal Server Error"
    const status = message.startsWith("Validation Failed") || message.includes("cannot be lower") || message.includes("Pricing is unavailable")
      ? 400
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
