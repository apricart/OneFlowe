import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets, orders, orderItems, organizationInventory, auditLogs, branches, globalProducts } from "@/db/schema"
import { and, desc, eq, gte, lte, sql, inArray } from "drizzle-orm"

const AUTO_APPROVAL_WINDOW_MS = 1000 * 60 * 60 * 2 // 2 hours

async function autoApproveStaleOrders() {
  const threshold = new Date(Date.now() - AUTO_APPROVAL_WINDOW_MS)

  const staleOrders = await db
    .select({
      id: orders.id,
      tid: orders.tid,
      organizationId: orders.organizationId,
      branchId: orders.branchId,
    })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lte(orders.createdAt, threshold)))

  if (!staleOrders.length) return

  const ids = staleOrders.map((o) => o.id)

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "approved", updatedAt: new Date() })
      .where(inArray(orders.id, ids))

    await tx.insert(auditLogs).values(
      staleOrders.map((ord) => ({
        userId: null,
        organizationId: ord.organizationId,
        branchId: ord.branchId,
        action: "AUTO_APPROVE",
        entity: "Order",
        entityId: String(ord.id),
        metadata: {
          tid: ord.tid,
          reason: "auto_approved_after_2_hours",
        },
      })),
    )
  })
}

function generateTid(): string {
  // Simple ULID-like: timestamp base36 + random base36
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return (ts + rand).slice(0, 26)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const role = (session.user as any).role
    const organizationIdRaw = (session.user as any).organizationId
    const branchIdFromUserRaw = (session.user as any).branchId
    const orgIdNum = organizationIdRaw && /^\d+$/.test(String(organizationIdRaw)) ? Number(organizationIdRaw) : undefined
    const branchIdFromUser = branchIdFromUserRaw && /^\d+$/.test(String(branchIdFromUserRaw)) ? Number(branchIdFromUserRaw) : undefined

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || undefined
    const branchId = searchParams.get("branchId") || undefined
    const q = searchParams.get("q") || undefined
    const from = searchParams.get("from") || undefined
    const to = searchParams.get("to") || undefined
    const organizationIdParam = searchParams.get("organizationId") || undefined
    const idParam = searchParams.get("id") || undefined

    const conditions: any[] = []
    if (role === "SUPER_ADMIN") {
      if (organizationIdParam && /^\d+$/.test(organizationIdParam)) {
        conditions.push(eq(orders.organizationId, Number(organizationIdParam)))
      }
    } else if (role === "HEAD_OFFICE") {
      if (typeof orgIdNum === 'number') conditions.push(eq(orders.organizationId, orgIdNum))
    } else {
      if (typeof orgIdNum === 'number') conditions.push(eq(orders.organizationId, orgIdNum))
      if (typeof branchIdFromUser === 'number') conditions.push(eq(orders.branchId, branchIdFromUser))
    }
    if (status) conditions.push(eq(orders.status, status))
    if (idParam && /^\d+$/.test(idParam)) conditions.push(eq(orders.id, Number(idParam)))
    if (branchId && /^\d+$/.test(branchId)) conditions.push(eq(orders.branchId, Number(branchId)))
    if (from) conditions.push(gte(orders.createdAt, new Date(from)))
    if (to) conditions.push(lte(orders.createdAt, new Date(to)))

    await autoApproveStaleOrders()

    const selectBase = db
      .select({
        id: orders.id,
        tid: orders.tid,
        organizationId: orders.organizationId,
        branchId: orders.branchId,
        status: orders.status,
        subtotalCents: orders.subtotalCents,
        taxCents: orders.taxCents,
        totalCents: orders.totalCents,
        createdAt: orders.createdAt,
        branchName: branches.name,
      })
      .from(orders)
      .leftJoin(branches, eq(orders.branchId, branches.id))

    const items = await (conditions.length 
      ? selectBase.where(and(...conditions)).orderBy(desc(orders.createdAt))
      : selectBase.orderBy(desc(orders.createdAt)))

    const filtered = q ? items.filter(o => o.tid.includes(q)) : items
    return NextResponse.json({ items: filtered })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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
      unit: r.unit 
    }))
    
    console.log("Mapped gp rows:", gpRows)

    const gpById = new Map(gpRows.map(r => [r.id, r]))
    const invById = new Map(invRows.map(r => [r.id, r]))

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

    // budget check and hold
    const budgetRows = await db.select().from(budgets).where(eq(budgets.branchId, branchId)).limit(1)
    const budget = budgetRows[0]
    if (!budget) return NextResponse.json({ error: "Budget not configured for branch" }, { status: 400 })

    const remaining = (budget.amountAllocatedCents + budget.amountCreditedCents) - (budget.amountSpentCents + budget.amountHeldCents)
    if (total > remaining) return NextResponse.json({ error: "Insufficient remaining budget" }, { status: 400 })

    const tid = generateTid()

    const created = await db.transaction(async (tx) => {
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

      await tx.insert(orderItems).values(calculatedItems.map(ci => {
        console.log("Inserting order item:", ci)
        return {
          ...ci, 
          orderId: ord.id,
          organizationId: Number(organizationId),
        }
      }))

      const budgetId = budget?.id
      if (!budgetId) throw new Error("Budget ID missing")
      
      await tx.update(budgets).set({ amountHeldCents: sql`${budgets.amountHeldCents} + ${total}` }).where(eq(budgets.id, budgetId))

      await tx.insert(auditLogs).values({ 
        userId, 
        action: 'CREATE_ORDER', 
        entity: 'Order', 
        entityId: String(ord.id), 
        organizationId: Number(organizationId), 
        branchId: Number(branchId), 
        metadata: { tid, total, items: items.length } 
      })

      return ord
    })

    return NextResponse.json({ message: 'Order created', order: created })
  } catch (e: any) {
    console.error("Order creation error:", e)
    console.error("Error stack:", e.stack)
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const role = (session.user as any).role
    const body = await req.json()
    const { id, action } = body as { id: number, action: 'approve' | 'cancel' | 'fulfill' }
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

    if (action === "fulfill" && role === "HEAD_OFFICE") {
      return NextResponse.json({ error: "Head office users cannot fulfill orders" }, { status: 403 })
    }

    const [ord] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
    if (!ord) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const [budget] = await db.select().from(budgets).where(eq(budgets.branchId, ord.branchId)).limit(1)
    if (!budget) return NextResponse.json({ error: 'Budget missing' }, { status: 400 })

    await db.transaction(async (tx) => {
      if (action === 'cancel') {
        await tx.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, id))
        await tx.update(budgets).set({ amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}` }).where(eq(budgets.id, (budget as any).id))
      } else if (action === 'approve') {
        await tx.update(orders).set({ status: 'approved' }).where(eq(orders.id, id))
      } else if (action === 'fulfill') {
        await tx.update(orders).set({ status: 'fulfilled' }).where(eq(orders.id, id))
        await tx.update(budgets).set({
          amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}`,
          amountSpentCents: sql`${budgets.amountSpentCents} + ${ord.totalCents}`,
        }).where(eq(budgets.id, (budget as any).id))
      }
      await tx.insert(auditLogs).values({ userId: (session.user as any).id, action: 'UPDATE', entity: 'Order', entityId: String(id), organizationId: ord.organizationId, branchId: ord.branchId, metadata: { action, tid: ord.tid } })
    })

    return NextResponse.json({ message: 'Order updated' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

