import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant } from "@/lib/db"
import { budgets, orders, orderItems, organizationInventory, branches, globalProducts, refunds, systemLogs, groupAuditLogs, organizations, refundItems } from "@/db/schema"
import { headers } from "next/headers"
import { and, desc, eq, gte, lte, sql, inArray } from "drizzle-orm"
import { logOrderActivity } from "@/lib/global-logger"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN", "ORDER_PORTAL"] as const
type Role = typeof allowedRoles[number]

function generateTid(): string {
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

    const { role: userRole, organizationId: userOrgId, branchId: userBranchId, id: userId } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_') as Role
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Build full tenant user context for 4-tier RBAC
    const tenantUser = {
      role: role,
      organizationId: userOrgId ? Number(userOrgId) : null,
      branchId: userBranchId ? Number(userBranchId) : null,
      id: userId || null
    }

    const { searchParams } = new URL(req.url)
    const rawStatus = searchParams.get("status") || undefined
    const status = rawStatus?.toUpperCase()
    const branchIdParam = searchParams.get("branchId") || undefined
    const branchIdsRaw = searchParams.get("branchIds") || undefined
    const q = searchParams.get("q") || undefined
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const organizationIdParam = searchParams.get("organizationId") || undefined
    const idParam = searchParams.get("id") || undefined
    const groupId = searchParams.get("groupId") || undefined

    const parsedBranchIds = branchIdsRaw
      ? branchIdsRaw.split(",").map(id => Number(id)).filter(id => !isNaN(id))
      : []

    const conditions: any[] = []

    // Note: RBAC is now enforced via PostgreSQL RLS policies
    // We only add user-provided filters here, not role-based access control
    
    // Optional: Allow SUPER_ADMIN to filter by specific organization
    if (role === "SUPER_ADMIN" && organizationIdParam && /^\d+$/.test(organizationIdParam)) {
      conditions.push(eq(orders.organizationId, Number(organizationIdParam)))
    }

    if (status) conditions.push(eq(orders.status, status))
    if (idParam && /^\d+$/.test(idParam)) conditions.push(eq(orders.id, Number(idParam)))

    if (parsedBranchIds.length > 0) {
      conditions.push(inArray(orders.branchId, parsedBranchIds))
    } else if (branchIdParam && /^\d+$/.test(branchIdParam)) {
      conditions.push(eq(orders.branchId, Number(branchIdParam)))
    }

    if (groupId && /^\d+$/.test(groupId)) conditions.push(eq(branches.groupId, Number(groupId)))

    if (startDate) conditions.push(gte(orders.createdAt, new Date(startDate)))
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      conditions.push(lte(orders.createdAt, end))
    }

    const { sanitizedItems, orderWithItems } = await withTenant(tenantUser, async (tx) => {
      // Log group access if applicable
      if (groupId && /^\d+$/.test(groupId)) {
        tx.insert(groupAuditLogs).values({
          organizationId: userOrgId || 0,
          groupId: Number(groupId),
          action: "VIEW_GROUP_REPORT",
          performedByUserId: userId,
          performedByRole: role,
          metadata: {
            filters: Object.fromEntries(searchParams.entries())
          },
        }).execute().catch(err => console.error("Audit log failed", err))
      }

      const selectBase = tx
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
          approvalToken: orders.approvalToken,
        })
        .from(orders)
        .leftJoin(branches, eq(orders.branchId, branches.id))
        .leftJoin(organizations, eq(orders.organizationId, organizations.id))

      const items = await (conditions.length
        ? selectBase.where(and(...conditions)).orderBy(desc(orders.createdAt))
        : selectBase.orderBy(desc(orders.createdAt)))

      const sanitizedItemsSync = items.map(item => {
        // Only BRANCH_ADMIN can see the approval token
        // The token is for Branch Admin to share with Head Office for verification
        const canSeeToken = role === "BRANCH_ADMIN";

        return {
          ...item,
          approvalToken: canSeeToken ? item.approvalToken : null
        }
      })

      const filtered = q ? sanitizedItemsSync.filter((o) => o.tid.toLowerCase().includes(q.toLowerCase())) : sanitizedItemsSync

      let orderWithItemsResult = null
      if (idParam && /^\d+$/.test(idParam)) {
        const orderId = Number(idParam)
        const order = filtered[0]
        if (order) {
          const itemsData = await tx
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

          const approvedRefunds = await tx
            .select({ amount: refunds.amountCents })
            .from(refunds)
            .where(and(eq(refunds.orderId, orderId), sql`UPPER(${refunds.status}) IN ('APPROVED', 'COMPLETED')`))

          const totalApprovedAmount = approvedRefunds.reduce((sum, r) => sum + (r.amount || 0), 0)
          orderWithItemsResult = { items: [{ ...order, orderItems: itemsData, refundAmountCents: totalApprovedAmount }] }
        }
      }

      return { sanitizedItems: filtered, orderWithItems: orderWithItemsResult }
    })

    if (orderWithItems) {
      return NextResponse.json(orderWithItems)
    }

    return NextResponse.json({ items: sanitizedItems })
  } catch (error: any) {
    console.error("[Orders API] GET failed:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { role: userRole, organizationId: userOrgId, branchId: userBranchId, id: userId, email: userEmail } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_') as Role
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { items, branchId: branchIdInput, organizationId: orgIdInput, notes } = body as { items: { organizationInventoryId: number, quantity: number }[], branchId?: number, organizationId?: number, notes?: string }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items required" }, { status: 400 })
    }

    if (items.some(i => i.quantity <= 0)) {
      return NextResponse.json({ error: "Quantities must be greater than zero" }, { status: 400 })
    }

    let organizationId = userOrgId
    if ((role === "HEAD_OFFICE" || role === "SUPER_ADMIN") && orgIdInput) {
      organizationId = orgIdInput
    }

    if (!organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 400 })
    }

    const branchId = (role === "HEAD_OFFICE" || role === "SUPER_ADMIN") ? Number(branchIdInput) : Number(userBranchId)
    if (isNaN(branchId)) {
      return NextResponse.json({ error: "Branch required" }, { status: 400 })
    }

    const tid = generateTid()

    const created = await withTenant(session.user as any, async (tx) => {
      const orgInvIds = items.map(i => i.organizationInventoryId)
      const allInvRows = await tx.select().from(organizationInventory)
        .where(and(
          eq(organizationInventory.organizationId, organizationId),
          inArray(organizationInventory.id, orgInvIds as any)
        ))

      if (allInvRows.length !== items.length) {
        throw new Error("One or more items are invalid for this organization")
      }

      const gpIds = allInvRows.map(r => r.globalProductId)
      const allGpRows = await tx.select().from(globalProducts).where(inArray(globalProducts.id, gpIds as any))
      const gpById = new Map(allGpRows.map(r => [r.id, r]))
      const invById = new Map(allInvRows.map(r => [r.id, r]))

      let subtotal = 0
      const calculatedItems = items.map(i => {
        const inv = invById.get(i.organizationInventoryId)
        const gp = gpById.get(inv!.globalProductId)
        const unitPrice = inv!.customPrice ?? gp!.basePrice
        const line = unitPrice * i.quantity
        subtotal += line
        return {
          globalProductId: inv!.globalProductId,
          quantity: i.quantity,
          priceCents: unitPrice,
          productName: gp!.name,
          productCode: gp!.productCode,
          unit: gp!.unit,
        }
      })

      const total = subtotal 

      const currentMonth = new Date().toISOString().slice(0, 7)
      let [budget] = await tx.select().from(budgets).where(
        and(eq(budgets.branchId, branchId), eq(budgets.period, currentMonth))
      ).limit(1)

      if (!budget) {
        const [branchData] = await tx.select({ 
          baselineBudgetCents: branches.baselineBudgetCents,
          organizationId: branches.organizationId 
        }).from(branches).where(eq(branches.id, branchId)).limit(1)

        if (branchData?.baselineBudgetCents && branchData.baselineBudgetCents > 0) {
          [budget] = await tx.insert(budgets).values({
            organizationId: branchData.organizationId,
            branchId,
            period: currentMonth,
            amountAllocatedCents: branchData.baselineBudgetCents,
            amountSpentCents: 0,
            amountHeldCents: 0,
            amountCreditedCents: 0,
          }).returning()
        } else {
          throw new Error(`Budget not configured for current month (${currentMonth})`)
        }
      }

      const remaining = (budget.amountAllocatedCents + budget.amountCreditedCents) - (budget.amountSpentCents + budget.amountHeldCents)
      if (total > remaining) {
        throw new Error(`Insufficient budget. Required: ${(total / 100).toFixed(2)} PKR, Available: ${(remaining / 100).toFixed(2)} PKR`)
      }

      const lockedGps = await tx.select().from(globalProducts).where(inArray(globalProducts.id, gpIds as any)).for('update')
      const lockedGpMap = new Map(lockedGps.map(g => [g.id, g]))

      for (const ci of calculatedItems) {
        const gp = lockedGpMap.get(ci.globalProductId)
        if (!gp || gp.stockQuantity < ci.quantity) {
          throw new Error(`Insufficient stock for ${gp?.name || 'product'}`)
        }
      }

      const { generateApprovalToken, hashApprovalToken } = await import('@/lib/approval-token')
      const plainToken = generateApprovalToken(10)
      const tokenHash = await hashApprovalToken(plainToken)

      const [ord] = await tx.insert(orders).values({
        tid,
        organizationId: Number(organizationId),
        branchId: Number(branchId),
        status: 'pending',
        subtotalCents: subtotal,
        taxCents: 0,
        totalCents: total,
        notes: notes || null,
        createdByUserId: userId,
        approvalToken: plainToken,
        approvalTokenHash: tokenHash,
        approvalTokenCreatedAt: new Date()
      }).returning()

      await tx.insert(orderItems).values(calculatedItems.map(ci => ({
        ...ci,
        orderId: ord.id,
        organizationId: Number(organizationId),
      })))

      for (const ci of calculatedItems) {
        await tx.update(globalProducts)
          .set({
            stockQuantity: sql`${globalProducts.stockQuantity} - ${ci.quantity}`,
            updatedAt: new Date()
          })
          .where(eq(globalProducts.id, ci.globalProductId))
      }

      await tx.update(budgets).set({ amountHeldCents: sql`${budgets.amountHeldCents} + ${total}` }).where(eq(budgets.id, budget.id))

      const { generateReceiptData } = await import('@/lib/receipt-generator')
      const receiptData = await generateReceiptData({
        orderId: ord.id,
        orderTid: tid,
        organizationId: Number(organizationId),
        branchId: Number(branchId),
        orderItemsData: calculatedItems,
        subtotalCents: subtotal,
        taxCents: 0,
        totalCents: total,
        discountCents: 0,
        deliveryChargesCents: 0,
      }).catch(err => {
        console.error("Receipt generation failed", err)
        return null
      })

      if (receiptData) {
        await tx.update(orders).set({ receiptData: receiptData as any }).where(eq(orders.id, ord.id))
      }

      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const ip = headersList.get("x-forwarded-for")?.split(',')[0] || "unknown"

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
        userAgent: userAgent || "unknown",
        success: true
      })

      logOrderActivity('CREATE', { ...ord, orderItems: calculatedItems }, { id: userId, email: userEmail, role })

      return { ...ord, _plainToken: plainToken }
    })

    return NextResponse.json({
      message: 'Order created',
      order: created,
      approvalToken: created._plainToken,
    })
  } catch (error: any) {
    console.error("[Orders API] POST failed:", error)
    return NextResponse.json({ error: error.message || "Failed to create order" }, { status: error.message?.includes("Insufficient") ? 400 : 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { role: userRole, id: userId, email: userEmail } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_') as Role
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (role === "HEAD_OFFICE") {
      return NextResponse.json({ error: "Read-only access" }, { status: 403 })
    }

    const body = await req.json()
    const { id, action, rejectionReason, approvalToken } = body as { id: number, action: 'approve' | 'cancel' | 'fulfill' | 'reject', rejectionReason?: string, approvalToken?: string }
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

    const result = await withTenant(session.user as any, async (tx) => {
      const [ord] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1)
      if (!ord) throw new Error("Order not found")

      const orderMonth = ord.createdAt ? ord.createdAt.toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7)
      const [budget] = await tx.select().from(budgets).where(
        and(eq(budgets.branchId, ord.branchId), eq(budgets.period, orderMonth))
      ).limit(1)

      if (!budget) throw new Error("Budget period not configured")

      const currentStatus = ord.status.toLowerCase()
      if (["cancelled", "fulfilled", "refunded", "rejected"].includes(currentStatus)) {
        throw new Error(`Cannot ${action} order already in ${currentStatus} state`)
      }

      let generatedApprovalToken: string | null = null

      if (action === 'cancel' || action === 'reject') {
        const targetStatus = action === 'cancel' ? 'cancelled' : 'rejected'
        await tx.update(orders).set({
          status: targetStatus,
          rejectedByUserId: action === 'reject' ? userId : null,
          rejectedAt: action === 'reject' ? new Date() : null,
          rejectionReason: action === 'reject' ? rejectionReason : null
        }).where(eq(orders.id, id))

        await tx.update(budgets).set({ amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}` }).where(eq(budgets.id, budget.id))

        const orderItemsList = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
        for (const item of orderItemsList) {
          await tx.update(globalProducts)
            .set({ stockQuantity: sql`${globalProducts.stockQuantity} + ${item.quantity}`, updatedAt: new Date() })
            .where(eq(globalProducts.id, item.globalProductId))
        }
      } else if (action === 'approve') {
        if (currentStatus !== 'pending') throw new Error("Only pending orders can be approved")

        const { generateApprovalToken, hashApprovalToken } = await import('@/lib/approval-token')
        const plainToken = generateApprovalToken(10)
        const tokenHash = await hashApprovalToken(plainToken)

        await tx.update(orders).set({
          status: 'approved',
          approvedByUserId: userId,
          approvedAt: new Date(),
          approvalToken: plainToken,
          approvalTokenHash: tokenHash,
          approvalTokenCreatedAt: new Date()
        }).where(eq(orders.id, id))

        generatedApprovalToken = plainToken
      } else if (action === 'fulfill') {
        if (!approvalToken) throw new Error("Approval token required")
        if (!ord.approvalTokenHash) throw new Error("Order not approved")

        const { verifyApprovalToken } = await import('@/lib/approval-token')
        const isValid = await verifyApprovalToken(approvalToken, ord.approvalTokenHash)

        if (!isValid) throw new Error("Invalid approval token")

        await tx.update(orders).set({
          status: 'fulfilled',
          fulfilledAt: new Date(),
          fulfilledByUserId: userId
        }).where(eq(orders.id, id))

        await tx.update(budgets).set({
          amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}`,
          amountSpentCents: sql`${budgets.amountSpentCents} + ${ord.totalCents}`,
        }).where(eq(budgets.id, budget.id))
      }

      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const ip = headersList.get("x-forwarded-for")?.split(',')[0] || "unknown"

      await tx.insert(systemLogs).values({
        userId,
        userRole: role,
        organizationId: ord.organizationId,
        branchId: ord.branchId,
        action: `ORDER_${action.toUpperCase()}`,
        resourceType: 'order',
        resourceId: String(id),
        details: { action, tid: ord.tid, rejectionReason },
        ipAddress: ip,
        userAgent: userAgent || "unknown",
        success: true
      })

      logOrderActivity(action.toUpperCase() as any, { ...ord, status: action === 'approve' ? 'approved' : action === 'fulfill' ? 'fulfilled' : action === 'cancel' ? 'cancelled' : 'rejected' }, { id: userId, email: userEmail, role })

      return { generatedApprovalToken }
    })

    return NextResponse.json({
      message: 'Order updated successfully',
      approvalToken: result.generatedApprovalToken
    })
  } catch (error: any) {
    console.error("[Orders API] PUT failed:", error)
    return NextResponse.json({ error: error.message || "Failed to update order" }, { status: 500 })
  }
}

