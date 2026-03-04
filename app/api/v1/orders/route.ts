import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets, orders, orderItems, organizationInventory, auditLogs, branches, globalProducts, refunds, systemLogs, groupAuditLogs, organizations, refundItems } from "@/db/schema"
import { headers } from "next/headers"
import { and, desc, eq, gte, lte, sql, inArray } from "drizzle-orm"
import { logOrderActivity } from "@/lib/global-logger"



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

    // Parsing branchIds
    const parsedBranchIds = branchIdsRaw
      ? branchIdsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id))
      : []

    const conditions: any[] = []

    // --- Role-based access ---
    if (role === "SUPER_ADMIN") {
      if (organizationIdParam && /^\d+$/.test(organizationIdParam))
        conditions.push(eq(orders.organizationId, Number(organizationIdParam)))
      // Super Admin sees ONLY Approved, Fulfilled, and Refunded orders
      conditions.push(sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED')`)
    } else if (role === "HEAD_OFFICE") {
      if (typeof orgIdNum === "number") conditions.push(eq(orders.organizationId, orgIdNum))
    } else {
      if (typeof orgIdNum === "number") conditions.push(eq(orders.organizationId, orgIdNum))
      if (typeof branchIdFromUser === "number") conditions.push(eq(orders.branchId, branchIdFromUser))
    }

    if (status && status !== "FULFILLED") conditions.push(eq(orders.status, status))
    if (idParam && /^\d+$/.test(idParam)) conditions.push(eq(orders.id, Number(idParam)))

    // Branch filtering
    if (parsedBranchIds.length > 0) {
      conditions.push(inArray(orders.branchId, parsedBranchIds))
    } else if (branchId && /^\d+$/.test(branchId)) {
      conditions.push(eq(orders.branchId, Number(branchId)))
    }

    if (groupId && /^\d+$/.test(groupId)) conditions.push(eq(branches.groupId, Number(groupId)))

    // Date range filtering (standardized)
    if (startDate) conditions.push(gte(orders.createdAt, new Date(startDate)))
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      conditions.push(lte(orders.createdAt, end))
    }

    // Legacy date filters
    if (from && !startDate) conditions.push(gte(orders.createdAt, new Date(from)))
    if (to && !endDate) conditions.push(lte(orders.createdAt, new Date(to)))

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




    // --- SALES MODE: Weekly / Monthly ---
    // Count orders when APPROVED (GMV style), not when fulfilled
    if (status === "FULFILLED") {
      // Include both APPROVED and FULFILLED orders in sales
      conditions.push(sql`${orders.approvedAt} IS NOT NULL`)
      conditions.push(sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED')`)

      if (startDate) conditions.push(gte(orders.approvedAt, new Date(startDate)))
      if (endDate) conditions.push(lte(orders.approvedAt, new Date(endDate)))

      // MONTHLY SALES
      if (mode === "monthlySales") {
        const monthlySales = await db
          .select({
            monthNum: sql<number>`EXTRACT(MONTH FROM ${orders.approvedAt})::int`,
            month: sql<string>`TO_CHAR(${orders.approvedAt}, 'Mon')`,
            sales: sql<number>`SUM(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0))::int`,
          })
          .from(orders)
          .leftJoin(branches, eq(orders.branchId, branches.id))
          .where(and(...conditions))
          .groupBy(sql`1,2`)
          .orderBy(sql`1`)

        return NextResponse.json(
          monthlySales.map((d) => ({
            month: d.month,
            sales: d.sales / 100, // cents → PKR
          }))
        )
      }

      // WEEKLY SALES
      const weeklySales = await db
        .select({
          day: sql<string>`TO_CHAR(${orders.approvedAt}, 'YYYY-MM-DD')`,
          ordersCount: sql<number>`COUNT(*)::int`,
          totalSales: sql<number>`SUM(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0))::int`,
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .where(and(...conditions))
        .groupBy(sql`1`)
        .orderBy(sql`1`)

      return NextResponse.json(weeklySales)
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

    // Sanitize items: Only show approvalToken to the user who approved it
    const sanitizedItems = items.map(item => ({
      ...item,
      approvalToken: item.approvedByUserId === currentUserId ? item.approvalToken : null
    }))

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

        return NextResponse.json({ items: [{ ...order, orderItems: itemsData, refundAmountCents: totalApprovedAmount }] })
      }
    }

    return NextResponse.json({ items: filtered })
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

    if (!budget) {
      return NextResponse.json({
        error: `Budget not configured for current month (${currentMonth}). Please contact head office to allocate budget.`
      }, { status: 400 })
    }

    const remaining = (budget.amountAllocatedCents + budget.amountCreditedCents) - (budget.amountSpentCents + budget.amountHeldCents)

    // Prevent negative budgets
    if (remaining < 0) {
      return NextResponse.json({
        error: "Budget is in negative state. Please contact head office."
      }, { status: 400 })
    }

    if (total > remaining) {
      return NextResponse.json({
        error: `Insufficient budget. Required: ${(total / 100).toFixed(2)} PKR, Available: ${(remaining / 100).toFixed(2)} PKR`
      }, { status: 400 })
    }

    const tid = generateTid()

    const created = await db.transaction(async (tx) => {
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

      // 3. Create Order
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
      const { generateReceiptData } = await import('@/lib/receipt-generator')
      try {
        const receiptData = await generateReceiptData({
          orderId: ord.id,
          orderTid: tid,
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

      const budgetId = budget?.id
      if (!budgetId) throw new Error("Budget ID missing")

      await tx.update(budgets).set({ amountHeldCents: sql`${budgets.amountHeldCents} + ${total}` }).where(eq(budgets.id, budgetId))

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

      return ord
    })

    return NextResponse.json({ message: 'Order created', order: created })
  } catch (e: any) {
    console.error("Order creation error:", e)
    console.error("Error stack:", e.stack)

    if (e.message && (
      e.message.startsWith("Insufficient stock") ||
      e.message.startsWith("Budget not configured") ||
      e.message.includes("Insufficient budget")
    )) {
      return NextResponse.json({ error: e.message }, { status: 400 })
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

    // Fetch budget for the current month period
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const [budget] = await db.select().from(budgets).where(
      and(
        eq(budgets.branchId, ord.branchId),
        eq(budgets.period, currentMonth)
      )
    ).limit(1)

    if (!budget) {
      return NextResponse.json({
        error: `Budget not configured for current month (${currentMonth})`
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
      if (action === 'cancel' || action === 'reject') {
        const targetStatus = action === 'cancel' ? 'cancelled' : 'rejected'
        // Only release budget if it was reserved (pending or approved)
        // We already checked it's not terminal, so it must be pending/approved.
        // For reject, create reason
        await tx.update(orders).set({
          status: targetStatus,
          rejectedByUserId: action === 'reject' ? (session.user as any).id : null,
          rejectedAt: action === 'reject' ? new Date() : null,
          rejectionReason: action === 'reject' ? rejectionReason : null
        }).where(eq(orders.id, id))

        await tx.update(budgets).set({ amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}` }).where(eq(budgets.id, (budget as any).id))

        // Restore stock for cancelled/rejected orders
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

        // Generate secure approval token
        const { generateApprovalToken, hashApprovalToken } = await import('@/lib/approval-token')
        const { logTokenGenerated } = await import('@/lib/global-logger')

        const plainToken = generateApprovalToken(10)
        const tokenHash = await hashApprovalToken(plainToken)

        await tx.update(orders).set({
          status: 'approved',
          approvedByUserId: (session.user as any).id,
          approvedAt: new Date(),
          approvalToken: plainToken, // Stored for approver to view later
          approvalTokenHash: tokenHash,
          approvalTokenCreatedAt: new Date()
        }).where(eq(orders.id, id))

        // Log token generation (without plaintext token)
        logTokenGenerated(
          id,
          ord.tid,
          (session.user as any).id,
          (session.user as any).email || 'unknown'
        )

        // Store token to return after transaction completes
        generatedApprovalToken = plainToken
      } else if (action === 'fulfill') {
        // SECURITY: Require approval token for fulfillment
        if (!approvalToken) {
          throw new Error('Approval token required to fulfill order')
        }

        if (!ord.approvalTokenHash) {
          throw new Error('Order has no approval token - cannot fulfill')
        }

        const { verifyApprovalToken } = await import('@/lib/approval-token')
        const { logFulfillmentAttempt } = await import('@/lib/global-logger')

        const isValid = await verifyApprovalToken(approvalToken, ord.approvalTokenHash)

        if (!isValid) {
          // Log failed attempt
          logFulfillmentAttempt(
            id,
            ord.tid,
            (session.user as any).id,
            (session.user as any).email || 'unknown',
            role,
            false,
            'Invalid token provided'
          )
          throw new Error('Invalid approval token - fulfillment denied')
        }

        // Token valid - proceed with fulfillment
        await tx.update(orders).set({
          status: 'fulfilled',
          fulfilledAt: sql`NOW()`,
          fulfilledByUserId: (session.user as any).id
        }).where(eq(orders.id, id))

        await tx.update(budgets).set({
          amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}`,
          amountSpentCents: sql`${budgets.amountSpentCents} + ${ord.totalCents}`,
        }).where(eq(budgets.id, (budget as any).id))

        // Log successful fulfillment
        logFulfillmentAttempt(
          id,
          ord.tid,
          (session.user as any).id,
          (session.user as any).email || 'unknown',
          role,
          true
        )
        // Stock already deducted on order creation, no additional action needed
      }

      // --- NEW: Detailed File Logging for Updates ---
      try {
        // Fetch order with items for full archival snapshot
        const currentOrderItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
        logOrderActivity(action.toUpperCase() as any, {
          ...ord,
          status: action === 'approve' ? 'approved' : (action === 'fulfill' ? 'fulfilled' : (action === 'cancel' ? 'cancelled' : 'rejected')),
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

