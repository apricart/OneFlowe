import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets, orders, orderItems, organizationInventory, auditLogs, branches, globalProducts } from "@/db/schema"
import { and, desc, eq, gte, lte, sql, inArray } from "drizzle-orm"

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

    const conditions: any[] = []
    if (role === "SUPER_ADMIN") {
      // optional org filter in future
    } else if (role === "HEAD_OFFICE") {
      if (typeof orgIdNum === 'number') conditions.push(eq(orders.organizationId, orgIdNum))
    } else {
      if (typeof orgIdNum === 'number') conditions.push(eq(orders.organizationId, orgIdNum))
      if (typeof branchIdFromUser === 'number') conditions.push(eq(orders.branchId, branchIdFromUser))
    }
    if (status) conditions.push(eq(orders.status, status))
    if (branchId && /^\d+$/.test(branchId)) conditions.push(eq(orders.branchId, Number(branchId)))
    if (from) conditions.push(gte(orders.createdAt, new Date(from)))
    if (to) conditions.push(lte(orders.createdAt, new Date(to)))

    const selectBase = db.select({
      id: orders.id,
      tid: orders.tid,
      organizationId: orders.organizationId,
      branchId: orders.branchId,
      status: orders.status,
      subtotalCents: orders.subtotalCents,
      taxCents: orders.taxCents,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
    }).from(orders)

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
    const organizationId = parseInt((session.user as any).organizationId)
    const userId = (session.user as any).id

    const body = await req.json()
    const { items, branchId: branchIdInput, notes } = body as { items: { organizationInventoryId: number, quantity: number }[], branchId?: number, notes?: string }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items required" }, { status: 400 })
    }

    const branchId = role === "HEAD_OFFICE" || role === "SUPER_ADMIN" ? parseInt(branchIdInput) : parseInt((session.user as any).branchId)
    if (!branchId) return NextResponse.json({ error: "Branch context required" }, { status: 400 })

    // Fetch inventory details and prices
    const orgInvIds = items.map(i => i.organizationInventoryId)
    const invRows = await db.select({
      id: organizationInventory.id,
      globalProductId: organizationInventory.globalProductId,
      customPriceCents: organizationInventory.customPriceCents,
    }).from(organizationInventory)
      .where(and(
        eq(organizationInventory.organizationId, organizationId),
        inArray(organizationInventory.id, orgInvIds as any)
      ))

    if (invRows.length !== orgInvIds.length) return NextResponse.json({ error: "Some items invalid" }, { status: 400 })

    // join to global products for base price and unit
    const gpIds = invRows.map(r => r.globalProductId)
    const gpRows = await db.select({ id: globalProducts.id, basePriceCents: globalProducts.basePriceCents, name: globalProducts.name, productCode: globalProducts.productCode, unit: globalProducts.unit })
      .from(globalProducts).where(inArray(globalProducts.id, gpIds as any))

    const gpById = new Map(gpRows.map(r => [r.id, r]))
    const invById = new Map(invRows.map(r => [r.id, r]))

    let subtotal = 0
    const calculatedItems = items.map(i => {
      const inv = invById.get(i.organizationInventoryId)!
      const gp = gpById.get(inv.globalProductId)!
      const unitPrice = inv.customPriceCents ?? gp.basePriceCents
      const line = unitPrice * (i.quantity || 0)
      subtotal += line
      return {
        organizationInventoryId: i.organizationInventoryId,
        quantity: i.quantity,
        unitPriceCents: unitPrice,
        lineTotalCents: line,
        productNameSnapshot: gp.name,
        productCodeSnapshot: gp.productCode,
        unitSnapshot: gp.unit,
      }
    })
    const tax = 0
    const total = subtotal + tax

    // budget check and hold
    const [budget] = await db.select({ id: budgets.id, amountAllocatedCents: budgets.amountAllocatedCents, amountSpentCents: budgets.amountSpentCents, amountHeldCents: budgets.amountHeldCents, amountCreditedCents: budgets.amountCreditedCents })
      .from(budgets).where(eq(budgets.branchId, branchId)).limit(1)
    if (!budget) return NextResponse.json({ error: "Budget not configured for branch" }, { status: 400 })

    const remaining = (budget.amountAllocatedCents + budget.amountCreditedCents) - (budget.amountSpentCents + budget.amountHeldCents)
    if (total > remaining) return NextResponse.json({ error: "Insufficient remaining budget" }, { status: 400 })

    const tid = generateTid()

    const created = await db.transaction(async (tx) => {
      const [ord] = await tx.insert(orders).values({
        tid,
        organizationId,
        branchId,
        status: 'pending',
        subtotalCents: subtotal,
        taxCents: tax,
        totalCents: total,
        notes: notes || null,
        budgetAtOrderCents: remaining,
        createdByUserId: userId,
        createdByRole: (session.user as any).role,
      }).returning()

      await tx.insert(orderItems).values(calculatedItems.map(ci => ({ ...ci, orderId: ord.id })))

      await tx.update(budgets).set({ amountHeldCents: sql`${budgets.amountHeldCents} + ${total}` }).where(eq(budgets.id, budget.id))

      await tx.insert(auditLogs).values({ userId, action: 'CREATE', entity: 'Order', entityId: String(ord.id), organizationId, branchId, metadata: { tid, total, items: items.length } })

      return ord
    })

    return NextResponse.json({ message: 'Order created', order: created })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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

