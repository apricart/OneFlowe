import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets, orders, orderItems, organizationInventory, auditLogs, branches, globalProducts, productQuantityBudgets, refunds, systemLogs, groupAuditLogs, organizations, refundItems } from "@/db/schema"
import { headers } from "next/headers"
import { and, desc, eq, gte, lte, sql, inArray } from "drizzle-orm"
import { logOrderActivity, logTokenGenerated, logFulfillmentAttempt } from "@/lib/global-logger"
import { generateApprovalToken, hashApprovalToken, verifyApprovalToken } from "@/lib/approval-token"
import { generateReceiptData } from "@/lib/receipt-generator"
import { shouldHidePricesForRole } from "@/lib/price-visibility"
import { parseEndDateParam, parseStartDateParam } from "@/lib/date-range-params"
import { getBudgetAllocationModeForOrganization } from "@/lib/server/budget-allocation-mode"
import {
  moveHeldQuantityBudgetToUsedForOrder,
  releaseHeldQuantityBudgetForOrder,
} from "@/lib/server/product-quantity-budget-ledger"



function generateTid(): string {
  // Simple ULID-like: timestamp base36 + random base36
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return (ts + rand).slice(0, 26)
}


export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    const organizationIdRaw = (session.user as any).organizationId
    const branchIdFromUserRaw = (session.user as any).branchId

    const orgIdNum =
      organizationIdRaw && /^\d+$/.test(String(organizationIdRaw))
        ? Number(organizationIdRaw)
        : undefined
    const branchIdFromUser =
      branchIdFromUserRaw && /^\d+$/.test(String(branchIdFromUserRaw))
        ? Number(branchIdFromUserRaw)
        : undefined

    const { searchParams } = new URL(req.url)
    const rawStatus = searchParams.get("status") || undefined
    const status = rawStatus?.toUpperCase()
    const branchId = searchParams.get("branchId") || undefined
    const branchIdsRaw = searchParams.get("branchIds") || undefined
    const q = searchParams.get("q") || undefined
    const from = searchParams.get("from") || undefined
    const to = searchParams.get("to") || undefined
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const organizationIdParam = searchParams.get("organizationId") || undefined
    const idParam = searchParams.get("id") || undefined
    const mode = searchParams.get("mode") || undefined // weeklySales | monthlySales
    const groupId = searchParams.get("groupId") || undefined
    const groupIdsRaw = searchParams.get("groupIds") || undefined
    const monthsRaw = searchParams.get("months") || undefined
    const yearsRaw = searchParams.get("years") || undefined

    // Parsing branchIds
    const parsedBranchIds = branchIdsRaw
      ? branchIdsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id))
      : []

    // Parsing groupIds
    const parsedGroupIds = groupIdsRaw
      ? groupIdsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id))
      : []

    const parsedMonths = monthsRaw
      ? monthsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id >= 1 && id <= 12)
      : []

    const parsedYears = yearsRaw
      ? yearsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id >= 2000 && id <= 2100)
      : []

    const conditions: any[] = []

    // --- Role-based access ---
    if (role === "SUPER_ADMIN") {
      if (organizationIdParam && /^\d+$/.test(organizationIdParam))
        conditions.push(eq(orders.organizationId, Number(organizationIdParam)))
      // Super Admin sees ALL orders for visibility consistency
      // conditions.push(sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED')`)
    } else if (role === "HEAD_OFFICE") {
      if (typeof orgIdNum === "number") conditions.push(eq(orders.organizationId, orgIdNum))
    } else if (role === "ORDER_PORTAL") {
      // CRITICAL: ORDER_PORTAL users should only see THEIR OWN orders
      const currentUserId = (session.user as any).id
      if (currentUserId) {
        conditions.push(eq(orders.createdByUserId, currentUserId))
      }
      // Also restrict to their organization and branch
      if (typeof orgIdNum === "number") conditions.push(eq(orders.organizationId, orgIdNum))
      if (typeof branchIdFromUser === "number") conditions.push(eq(orders.branchId, branchIdFromUser))
    } else {
      // BRANCH_ADMIN and other roles
      if (typeof orgIdNum === "number") conditions.push(eq(orders.organizationId, orgIdNum))
      if (typeof branchIdFromUser === "number") conditions.push(eq(orders.branchId, branchIdFromUser))
    }

    const pricesHidden = await shouldHidePricesForRole(role, orgIdNum)

    if (status) conditions.push(eq(orders.status, status))
    if (idParam && /^\d+$/.test(idParam)) conditions.push(eq(orders.id, Number(idParam)))

    // Branch filtering
    if (parsedBranchIds.length > 0) {
      conditions.push(inArray(orders.branchId, parsedBranchIds))
    } else if (branchId && /^\d+$/.test(branchId)) {
      conditions.push(eq(orders.branchId, Number(branchId)))
    }

    // Group filtering
    if (parsedGroupIds.length > 0) {
      conditions.push(inArray(branches.groupId, parsedGroupIds))
    } else if (groupId && /^\d+$/.test(groupId)) {
      conditions.push(eq(branches.groupId, Number(groupId)))
    }

    // Date range filtering (standardized)
    if (startDate) {
      const start = parseStartDateParam(startDate)
      if (start) conditions.push(gte(orders.createdAt, start))
    }
    if (endDate) {
      const end = parseEndDateParam(endDate)
      if (end) conditions.push(lte(orders.createdAt, end))
    }

    // Arbitrary month/year filtering from GlobalDateFilter.
    if (parsedMonths.length > 0) {
      conditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
    }

    if (parsedYears.length > 0) {
      conditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
    }

    // Legacy date filters
    if (from && !startDate) {
      const start = parseStartDateParam(from)
      if (start) conditions.push(gte(orders.createdAt, start))
    }
    if (to && !endDate) {
      const end = parseEndDateParam(to)
      if (end) conditions.push(lte(orders.createdAt, end))
    }

    // --- Audit Logging for Group Access ---
    if (groupId && /^\d+$/.test(groupId)) {
      // Log access to group-specific data
      // We do this asynchronously to not block the response
      (async () => {
        try {
          await db.insert(groupAuditLogs).values({
            organizationId: orgIdNum || 0, // Best effort
            groupId: Number(groupId),
            action: "VIEW_GROUP_REPORT",
            performedByUserId: (session.user as any).id,
            performedByRole: role,
            metadata: {
              filters: Object.fromEntries(searchParams.entries())
            },
          })
        } catch (err) {
          console.error("Audit log failed", err)
        }
      })()
    }




    // --- Base query (non-sales) ---
    const selectBase = db
      .select({
        id: orders.id,
        tid: orders.tid,
        organizationId: orders.organizationId,
        organizationName: organizations.name,
        branchId: orders.branchId,
        status: orders.status,
        statusAtRefund: orders.statusAtRefund,
        refundedAt: orders.refundedAt,
        refundedByUserId: orders.refundedByUserId,
        refundAmountCents: orders.refundAmountCents,
        refundReason: orders.refundReason,
        rejectionReason: orders.rejectionReason,
        subtotalCents: orders.subtotalCents,
        taxCents: orders.taxCents,
        totalCents: orders.totalCents,
        createdAt: orders.createdAt,
        fulfilledAt: orders.fulfilledAt,
        branchName: branches.name,
        hasRefundRequests: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${refunds}
          WHERE ${refunds.orderId} = ${orders.id}
          AND UPPER(${refunds.status}) = 'PENDING'
        )`,
        itemCount: sql<number>`(
          SELECT SUM(${orderItems.quantity})::int
          FROM ${orderItems}
          WHERE ${orderItems.orderId} = ${orders.id}
        )`,
        itemNames: sql<string>`(
          SELECT STRING_AGG(${orderItems.productName}, ', ')
          FROM ${orderItems}
          WHERE ${orderItems.orderId} = ${orders.id}
        )`,
        approvedByUserId: orders.approvedByUserId,
        approvalToken: orders.approvalToken, // Will be filtered before return
      })
      .from(orders)
      .leftJoin(branches, eq(orders.branchId, branches.id))
      .leftJoin(organizations, eq(orders.organizationId, organizations.id))

    const items = await (conditions.length
      ? selectBase.where(and(...conditions)).orderBy(desc(orders.createdAt))
      : selectBase.orderBy(desc(orders.createdAt)))

    const currentUserId = (session.user as any).id

    // Sanitize items: Only show approvalToken to authorized roles
    const sanitizedItems = items.map(item => {
      // Show token if:
      // 1. User is the one who approved it
      // 2. User is a Super Admin (needs it for fulfillment)
      // 3. User is a Branch Admin (needs it to hand off to Super Admin)
      const canSeeToken =
        item.approvedByUserId === currentUserId ||
        role === "SUPER_ADMIN" ||
        role === "BRANCH_ADMIN";

      const safeItem = pricesHidden
        ? {
          ...item,
          subtotalCents: null,
          taxCents: null,
          totalCents: null,
          refundAmountCents: null,
        }
        : item

      return {
        ...safeItem,
        approvalToken: canSeeToken ? item.approvalToken : null
      }
    })

    const filtered = q ? sanitizedItems.filter((o) => o.tid.includes(q)) : sanitizedItems

    // Single order with items
    if (idParam && /^\d+$/.test(idParam)) {
      const orderId = Number(idParam)
      const order = filtered[0]
      if (order) {
        const itemsData = await db
          .select({
            id: orderItems.id,
            productName: orderItems.productName,
            productCode: orderItems.productCode,
            quantity: orderItems.quantity,
            priceCents: orderItems.priceCents,
            unit: orderItems.unit,
            globalProductId: orderItems.globalProductId,
            imageUrl: globalProducts.imageUrl,
            quantityRefunded: sql<number>`COALESCE((
              SELECT SUM(${refundItems.quantity})::int
              FROM ${refundItems}
              JOIN ${refunds} ON ${refundItems.refundId} = ${refunds.id}
              WHERE ${refundItems.orderItemId} = ${orderItems.id}
              AND UPPER(${refunds.status}) IN ('APPROVED', 'COMPLETED')
            ), 0)`.mapWith(Number),
          })
          .from(orderItems)
          .leftJoin(globalProducts, eq(orderItems.globalProductId, globalProducts.id))
          .where(eq(orderItems.orderId, orderId))

        // Calculate total refund amount from APPROVED refund records
        const approvedRefunds = await db
          .select({ amount: refunds.amountCents })
          .from(refunds)
          .where(and(eq(refunds.orderId, orderId), sql`UPPER(${refunds.status}) IN ('APPROVED', 'COMPLETED')`))

        const totalApprovedAmount = approvedRefunds.reduce((sum, r) => sum + (r.amount || 0), 0)

        return NextResponse.json({
          items: [{
            ...order,
            orderItems: pricesHidden
              ? itemsData.map((item) => ({ ...item, priceCents: null }))
              : itemsData,
            refundAmountCents: pricesHidden ? null : totalApprovedAmount,
            pricesHidden,
          }],
          pricesHidden,
        })
      }
    }

    return NextResponse.json({ items: filtered, pricesHidden })
  } catch (e: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const role = (session.user as any).role
    let organizationId = (session.user as any).organizationId
    if (organizationId) organizationId = parseInt(String(organizationId))
    const userId = (session.user as any).id

    const body = await req.json()
    const { items, branchId: branchIdInput, organizationId: orgIdInput, notes } = body as { items: { organizationInventoryId: number, quantity: number }[], branchId?: number, organizationId?: number, notes?: string }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items required" }, { status: 400 })
    }

    // Validate quantities are positive
    if (items.some(i => i.quantity <= 0)) {
      return NextResponse.json({ error: "Quantities must be greater than zero" }, { status: 400 })
    }

    // For admin users, accept organizationId and branchId from request body (from context selector)
    if (role === "HEAD_OFFICE" || role === "SUPER_ADMIN") {
      if (orgIdInput && Number.isFinite(orgIdInput)) {
        organizationId = orgIdInput
      }
    }

    if (!Number.isFinite(organizationId)) {
      return NextResponse.json({ error: "Organization ID not found" }, { status: 400 })
    }

    const branchId = role === "HEAD_OFFICE" || role === "SUPER_ADMIN" ? parseInt(String(branchIdInput)) : parseInt(String((session.user as any).branchId))
    if (!Number.isFinite(branchId)) return NextResponse.json({ error: "Branch context required" }, { status: 400 })
    const pricesHidden = await shouldHidePricesForRole(role, organizationId)
    const budgetAllocationMode = await getBudgetAllocationModeForOrganization(Number(organizationId))

    // Fetch inventory details and prices
    const orgInvIds = items.map(i => i.organizationInventoryId)
    const allInvRows = await db.select().from(organizationInventory)
      .where(and(
        eq(organizationInventory.organizationId, organizationId),
        inArray(organizationInventory.id, orgInvIds as any)
      ))

    const invRows = allInvRows.map(r => ({
      id: r.id,
      globalProductId: r.globalProductId,
      customPrice: r.customPrice // Use customPrice not customPriceCents
    }))

    console.log("Organization ID:", organizationId)
    console.log("Org Inventory IDs:", orgInvIds)
    console.log("Inventory rows fetched:", invRows.length)

    if (invRows.length !== orgInvIds.length) return NextResponse.json({ error: "Some items invalid" }, { status: 400 })

    // join to global products for base price and unit
    const gpIds = invRows.map(r => r.globalProductId)
    const allGpRows = await db.select().from(globalProducts).where(inArray(globalProducts.id, gpIds as any))

    console.log("Global product rows:", allGpRows.map(r => ({ id: r.id, unit: r.unit, name: r.name })))

    const gpRows = allGpRows.map(r => ({
      id: r.id,
      basePrice: r.basePrice, // Use basePrice not basePriceCents
      name: r.name,
      productCode: r.productCode,
      unit: r.unit,
      stockQuantity: r.stockQuantity
    }))

    console.log("Mapped gp rows:", gpRows)

    const gpById = new Map(gpRows.map(r => [r.id, r]))
    const invById = new Map(invRows.map(r => [r.id, r]))

    // We will do the stock check inside the transaction with FOR UPDATE locking
    // to prevent race conditions that lead to negative stock.

    let subtotal = 0
    const calculatedItems = items.map(i => {
      const inv = invById.get(i.organizationInventoryId)
      if (!inv) throw new Error(`Inventory item ${i.organizationInventoryId} not found`)
      const gp = gpById.get(inv.globalProductId)
      if (!gp) throw new Error(`Global product for inventory ${inv.globalProductId} not found`)

      console.log(`Item ${i.organizationInventoryId}:`, {
        customPriceCents: inv.customPrice,
        basePriceCents: gp.basePrice,
        gpId: gp.id,
      })

      const unitPrice = inv.customPrice ?? gp.basePrice
      if (unitPrice === null || unitPrice === undefined) throw new Error(`Price not found for item ${i.organizationInventoryId}. Custom: ${inv.customPrice}, Base: ${gp.basePrice}`)
      const line = unitPrice * (i.quantity || 0)
      subtotal += line
      return {
        organizationInventoryId: i.organizationInventoryId,
        globalProductId: inv.globalProductId,
        quantity: i.quantity,
        priceCents: unitPrice,
        productName: gp.name,
        productCode: gp.productCode,
        unit: gp.unit,
      }
    })
    const tax = 0
    const total = subtotal + tax

    // budget check and hold - must be for current month period
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const budgetRows = await db.select().from(budgets).where(
      and(
        eq(budgets.branchId, branchId),
        eq(budgets.period, currentMonth)
      )
    ).limit(1)
    const budget = budgetRows[0]

    let currentBudget = budget
    if (!currentBudget) {
      // Check if branch has a baseline budget to auto-initialize
      const [branchData] = await db.select({
        baselineBudgetCents: branches.baselineBudgetCents,
        organizationId: branches.organizationId
      })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1)

      if (branchData?.baselineBudgetCents && branchData.baselineBudgetCents > 0) {
        // Auto-initialize budget from baseline
        const [newBudget] = await db.insert(budgets).values({
          organizationId: branchData.organizationId,
          branchId,
          period: currentMonth,
          amountAllocatedCents: branchData.baselineBudgetCents,
          amountSpentCents: 0,
          amountHeldCents: 0,
          amountCreditedCents: 0,
        }).returning()
        currentBudget = newBudget
      } else {
        return NextResponse.json({
          error: `Budget not configured for current month (${currentMonth}). Please contact head office to allocate budget.`
        }, { status: 400 })
      }
    }

    const remaining = (currentBudget.amountAllocatedCents + currentBudget.amountCreditedCents) - (currentBudget.amountSpentCents + currentBudget.amountHeldCents)

    // Prevent negative budgets
    if (remaining < 0) {
      return NextResponse.json({
        error: "Budget is in negative state. Please contact head office."
      }, { status: 400 })
    }

    if (total > remaining) {
      return NextResponse.json({
        error: pricesHidden
          ? "Insufficient budget. Please contact head office."
          : `Insufficient budget. Required: ${(total / 100).toFixed(2)} PKR, Available: ${(remaining / 100).toFixed(2)} PKR`
      }, { status: 400 })
    }

    const tid = generateTid()

    const created = await db.transaction(async (tx) => {
      const budgetId = currentBudget?.id
      if (!budgetId) throw new Error("Budget ID missing")

      // Re-check the money budget under lock before placing a hold.
      const [lockedBudget] = await tx.select()
        .from(budgets)
        .where(eq(budgets.id, budgetId))
        .for('update')

      if (!lockedBudget) throw new Error(`Budget not configured for current month (${currentMonth})`)

      const lockedMoneyRemaining =
        (lockedBudget.amountAllocatedCents + lockedBudget.amountCreditedCents) -
        (lockedBudget.amountSpentCents + lockedBudget.amountHeldCents)

      if (lockedMoneyRemaining < 0) {
        throw new Error("Budget is in negative state. Please contact head office.")
      }

      if (total > lockedMoneyRemaining) {
        throw new Error(pricesHidden
          ? "Insufficient budget. Please contact head office."
          : `Insufficient budget. Required: ${(total / 100).toFixed(2)} PKR, Available: ${(lockedMoneyRemaining / 100).toFixed(2)} PKR`)
      }

      const positiveQuantityBudgetTotal = sql`(${productQuantityBudgets.allocatedQuantity} + ${productQuantityBudgets.creditedQuantity}) > 0`
      const quantityBudgetModeActive = budgetAllocationMode === "quantity"

      const quantityBudgetRows = quantityBudgetModeActive
        ? await tx.select()
          .from(productQuantityBudgets)
          .where(and(
            eq(productQuantityBudgets.organizationId, Number(organizationId)),
            eq(productQuantityBudgets.branchId, Number(branchId)),
            eq(productQuantityBudgets.period, currentMonth),
            positiveQuantityBudgetTotal,
            inArray(productQuantityBudgets.organizationInventoryId, calculatedItems.map((item) => item.organizationInventoryId)),
          ))
          .for('update')
        : []

      const quantityBudgetByOrgInventoryId = new Map(
        quantityBudgetRows.map((row) => [row.organizationInventoryId, row])
      )

      for (const item of calculatedItems) {
        const quantityBudget = quantityBudgetByOrgInventoryId.get(item.organizationInventoryId)
        if (!quantityBudget) {
          if (quantityBudgetModeActive) {
            throw new Error(`Quantity budget is not allocated for ${item.productName}. Please select an allocated product.`)
          }
          continue
        }

        const quantityRemaining =
          quantityBudget.allocatedQuantity +
          quantityBudget.creditedQuantity -
          quantityBudget.usedQuantity -
          quantityBudget.heldQuantity

        if (quantityRemaining < 0) {
          throw new Error(`Quantity budget for ${item.productName} is in negative state. Please contact head office.`)
        }

        if (item.quantity > quantityRemaining) {
          throw new Error(`Insufficient quantity budget for ${item.productName}. Available: ${quantityRemaining}, Requested: ${item.quantity}`)
        }
      }

      // 1. Lock global products to update stock safely
      const gpIdsForLock = calculatedItems.map(i => i.globalProductId)
      const lockedGps = await tx.select()
        .from(globalProducts)
        .where(inArray(globalProducts.id, gpIdsForLock))
        .for('update')

      const lockedGpMap = new Map(lockedGps.map(g => [g.id, g]))

      // 2. Perform FINAL stock check inside the lock
      for (const ci of calculatedItems) {
        const gp = lockedGpMap.get(ci.globalProductId)
        if (!gp) throw new Error(`Product not found: ${ci.productName}`)

        if (gp.stockQuantity < ci.quantity) {
          // Inside transaction, throwing error will rollback
          throw new Error(`Insufficient stock for ${gp.name}. Available: ${gp.stockQuantity}, Requested: ${ci.quantity}`)
        }
      }

      // Generate token for instant approval
      const plainToken = generateApprovalToken(10)
      const tokenHash = await hashApprovalToken(plainToken)

      // 3. Create Order in PENDING state
      const [ord] = await tx.insert(orders).values({
        tid,
        organizationId: Number(organizationId),
        branchId: Number(branchId),
        status: 'pending',
        subtotalCents: subtotal,
        taxCents: tax,
        totalCents: total,
        notes: notes || null,
        createdByUserId: userId,
      }).returning()

      // 4. Create Order Items
      await tx.insert(orderItems).values(calculatedItems.map(ci => ({
        ...ci,
        orderId: ord.id,
        organizationId: Number(organizationId),
      })))

      // 5. Deduct stock using the lock
      for (const ci of calculatedItems) {
        await tx.update(globalProducts)
          .set({
            stockQuantity: sql`${globalProducts.stockQuantity} - ${ci.quantity}`,
            updatedAt: new Date()
          })
          .where(eq(globalProducts.id, ci.globalProductId))
      }

      // 6. Generate and store receipt data
      try {
        const receiptData = await generateReceiptData({
          orderId: ord.id,
          orderTid: tid,
          status: 'pending',
          organizationId: Number(organizationId),
          branchId: Number(branchId),
          orderItemsData: calculatedItems,
          subtotalCents: subtotal,
          taxCents: tax,
          totalCents: total,
          discountCents: 0,
          deliveryChargesCents: 0,
        })

        // Update order with receipt data
        await tx.update(orders)
          .set({ receiptData: receiptData as any })
          .where(eq(orders.id, ord.id))
      } catch (receiptErr) {
        console.error("Receipt generation failed during order creation", receiptErr)
        // Don't fail the order if receipt generation fails
      }

      await tx.update(budgets).set({ amountHeldCents: sql`${budgets.amountHeldCents} + ${total}` }).where(eq(budgets.id, budgetId))

      for (const item of calculatedItems) {
        const quantityBudget = quantityBudgetByOrgInventoryId.get(item.organizationInventoryId)
        if (!quantityBudget) continue

        await tx.update(productQuantityBudgets)
          .set({
            heldQuantity: sql`${productQuantityBudgets.heldQuantity} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(productQuantityBudgets.id, quantityBudget.id))
      }

      // --- NEW: Detailed File Logging ---
      try {
        // Log complete order details for archival
        logOrderActivity('CREATE', {
          ...ord,
          orderItems: calculatedItems
        }, {
          id: userId,
          email: session.user?.email || 'unknown',
          role: role
        })
      } catch (logErr) {
        console.error("File logging failed during order creation", logErr)
      }

      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const forwardedFor = headersList.get("x-forwarded-for")
      const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown"

      await tx.insert(systemLogs).values({
        userId,
        userRole: role,
        organizationId: Number(organizationId),
        branchId: Number(branchId),
        action: 'ORDER_CREATE',
        resourceType: 'order',
        resourceId: String(ord.id),
        details: { tid, total, items: items.length },
        ipAddress: ip,
        userAgent: userAgent,
        success: true
      })

      // Log token generation
      logTokenGenerated(
        ord.id,
        tid,
        userId,
        session.user?.email || 'unknown'
      )

      return { ...ord, _plainToken: plainToken }
    })

    const safeOrder = pricesHidden
      ? {
        ...created,
        subtotalCents: null,
        taxCents: null,
        totalCents: null,
      }
      : created

    return NextResponse.json({
      message: 'Order created',
      order: safeOrder,
      approvalToken: created._plainToken,
      warning: 'SAVE THIS TOKEN! It is required by Super Admins to fulfill the order.'
    })
  } catch (e: any) {
    console.error("Order creation error:", e)
    console.error("Error stack:", e.stack)

    const orderErrorMessage = String(e.message || "")
    const normalizedOrderErrorMessage = orderErrorMessage.toLowerCase()

    if (orderErrorMessage && (
      orderErrorMessage.startsWith("Insufficient stock") ||
      orderErrorMessage.startsWith("Budget not configured") ||
      orderErrorMessage.includes("Insufficient budget") ||
      normalizedOrderErrorMessage.includes("quantity budget") ||
      normalizedOrderErrorMessage.includes("negative state")
    )) {
      return NextResponse.json({ error: orderErrorMessage }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const role = (session.user as any).role
    const body = await req.json()
    const { id, action, rejectionReason, approvalToken } = body as { id: number, action: 'approve' | 'cancel' | 'fulfill' | 'reject', rejectionReason?: string, approvalToken?: string }
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

    if (role === "HEAD_OFFICE") {
      return NextResponse.json({ error: "Head office users have view-only access" }, { status: 403 })
    }

    const [ord] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
    if (!ord) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Fetch budget for the ORDER's creation month (not today's month!)
    // This ensures fulfilling/cancelling an order from a previous month
    // updates the correct month's budget record.
    const orderMonth = ord.createdAt
      ? new Date(ord.createdAt).toISOString().slice(0, 7)
      : new Date().toISOString().slice(0, 7) // fallback to current month
    const [budget] = await db.select().from(budgets).where(
      and(
        eq(budgets.branchId, ord.branchId),
        eq(budgets.period, orderMonth)
      )
    ).limit(1)

    if (!budget) {
      return NextResponse.json({
        error: `Budget not configured for order month (${orderMonth})`
      }, { status: 400 })
    }

    // Validate state transitions to prevent budget corruption
    const currentStatus = ord.status.toLowerCase()
    const isTerminal = ["cancelled", "fulfilled", "refunded", "rejected"].includes(currentStatus)

    if (isTerminal) {
      return NextResponse.json({
        error: `Cannot ${action} order that is already ${currentStatus}`
      }, { status: 400 })
    }

    let generatedApprovalToken: string | null = null

    await db.transaction(async (tx) => {
      // ─── Status and Receipt Update Preparation ───
      const targetStatus = action === 'cancel' ? 'cancelled' :
        action === 'reject' ? 'rejected' :
          action === 'approve' ? 'approved' : 'fulfilled'

      const updatedReceiptData = ord.receiptData ? {
        ...(ord.receiptData as any),
        status: targetStatus
      } : null

      if (action === 'cancel' || action === 'reject') {
        // 1. Update Order Status
        await tx.update(orders).set({
          status: targetStatus,
          rejectedByUserId: action === 'reject' ? (session.user as any).id : null,
          rejectedAt: action === 'reject' ? new Date() : null,
          rejectionReason: action === 'reject' ? rejectionReason : null,
          receiptData: updatedReceiptData as any
        }).where(eq(orders.id, id))

        // 2. Release Budget
        await tx.update(budgets).set({
          amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}`
        }).where(eq(budgets.id, budget.id))

        // 3. Release quantity budget and restore stock
        await releaseHeldQuantityBudgetForOrder(tx, ord)

        const orderItemsList = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
        for (const item of orderItemsList) {
          await tx.update(globalProducts)
            .set({
              stockQuantity: sql`${globalProducts.stockQuantity} + ${item.quantity}`,
              updatedAt: new Date()
            })
            .where(eq(globalProducts.id, item.globalProductId))
        }
      } else if (action === 'approve') {
        if (currentStatus !== 'pending') {
          throw new Error(`Cannot approve order in ${currentStatus} state`)
        }

        const plainToken = generateApprovalToken(10)
        const tokenHash = await hashApprovalToken(plainToken)

        await tx.update(orders).set({
          status: 'approved',
          approvedByUserId: (session.user as any).id,
          approvedAt: new Date(),
          approvalToken: plainToken,
          approvalTokenHash: tokenHash,
          approvalTokenCreatedAt: new Date(),
          receiptData: updatedReceiptData as any
        }).where(eq(orders.id, id))

        logTokenGenerated(id, ord.tid, (session.user as any).id, (session.user as any).email || 'unknown')
        generatedApprovalToken = plainToken

      } else if (action === 'fulfill') {
        if (!approvalToken) throw new Error('Approval token required to fulfill order')
        if (!ord.approvalTokenHash) throw new Error('Order has no approval token - cannot fulfill')

        const isValid = await verifyApprovalToken(approvalToken, ord.approvalTokenHash)

        if (!isValid) {
          logFulfillmentAttempt(id, ord.tid, (session.user as any).id, (session.user as any).email || 'unknown', role, false, 'Invalid token provided')
          throw new Error('Invalid approval token - fulfillment denied')
        }

        await tx.update(orders).set({
          status: 'fulfilled',
          fulfilledAt: sql`NOW()`,
          fulfilledByUserId: (session.user as any).id,
          receiptData: updatedReceiptData as any
        }).where(eq(orders.id, id))

        await tx.update(budgets).set({
          amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}`,
          amountSpentCents: sql`${budgets.amountSpentCents} + ${ord.totalCents}`,
        }).where(eq(budgets.id, budget.id))

        await moveHeldQuantityBudgetToUsedForOrder(tx, ord)

        logFulfillmentAttempt(id, ord.tid, (session.user as any).id, (session.user as any).email || 'unknown', role, true)
      }

      // --- NEW: Detailed File Logging for Updates ---
      try {
        const currentOrderItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
        logOrderActivity(action.toUpperCase() as any, {
          ...ord,
          status: targetStatus,
          orderItems: currentOrderItems
        }, {
          id: (session.user as any).id,
          email: (session.user as any).email || 'unknown',
          role: role
        })
      } catch (logErr) {
        console.error(`File logging failed during order ${action}`, logErr)
      }

      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const forwardedFor = headersList.get("x-forwarded-for")
      const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown"

      await tx.insert(systemLogs).values({
        userId: (session.user as any).id,
        userRole: role,
        organizationId: ord.organizationId,
        branchId: ord.branchId,
        action: `ORDER_${action.toUpperCase()}`,
        resourceType: 'order',
        resourceId: String(id),
        details: { action, tid: ord.tid, rejectionReason },
        ipAddress: ip,
        userAgent: userAgent,
        success: true
      })
    })

    // Return token only for approve action (shown ONCE to user)
    if (action === 'approve' && generatedApprovalToken) {
      return NextResponse.json({
        message: 'Order approved successfully',
        approvalToken: generatedApprovalToken,
        warning: 'SAVE THIS TOKEN! It will not be shown again.'
      })
    }

    return NextResponse.json({ message: 'Order updated' })
  } catch (e: any) {
    console.error("PUT order error:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}

