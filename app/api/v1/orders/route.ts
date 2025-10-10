import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { store, type OrderItem, type OrderStatus } from "@/lib/store"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId") || undefined
  const branchId = searchParams.get("branchId") || undefined
  const status = (searchParams.get("status") || undefined) as OrderStatus | undefined
  const items = store.listOrders({ organizationId, branchId, status })
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
  const created = store.createOrder({
    organizationId: String(body.organizationId),
    branchId: String(body.branchId),
    requestedByUserId: String(body.requestedByUserId || ""),
    items,
    note: body.note ? String(body.note) : undefined,
    status: "PENDING",
  })
  return ok({ item: created }, { status: 201 })
}
