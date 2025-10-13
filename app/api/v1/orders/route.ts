import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, orderItems } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
type OrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED"
type OrderItem = { sku: string; name: string; quantity: number; unit: string }

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const status = (searchParams.get("status") || undefined) as OrderStatus | undefined
  const where = [branchId ? eq(orders.branchId, Number(branchId)) : undefined, status ? eq(orders.status, status) : undefined].filter(Boolean) as any
  const items = await db.select().from(orders).where(where.length ? and(...where) : undefined as any).orderBy(desc(orders.createdAt))
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["BRANCH_ADMIN"]) // Branch creates orders
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.organizationId || !body?.branchId || !Array.isArray(body?.items)) {
    return error("organizationId, branchId, items are required", 400)
  }
  const items: OrderItem[] = body.items.map((it: any) => ({
    sku: String(it.sku || ""),
    name: String(it.name || ""),
    quantity: Number(it.quantity || 0),
    unit: String(it.unit || "unit"),
  }))
  const [created] = await db.insert(orders).values({
    branchId: Number(body.branchId),
    status: "PENDING",
    totalCents: 0,
    createdByUserId: String(body.requestedByUserId || ""),
  }).returning()
  if (items.length) {
    await db.insert(orderItems).values(items.map((it) => ({
      orderId: created.id,
      skuId: 0, // TODO: map from SKU catalog
      quantity: it.quantity,
      priceCents: 0,
    })))
  }
  return ok({ item: created }, { status: 201 })
}

