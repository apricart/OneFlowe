import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { store } from "@/lib/store"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"]) 
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId") || undefined
  const branchId = searchParams.get("branchId") || undefined
  const type = (searchParams.get("type") || undefined) as any
  const items = store.listInventoryTransactions({ organizationId, branchId, type })
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"]) 
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.organizationId || !body?.branchId || !Array.isArray(body?.items) || !body?.type) {
    return error("organizationId, branchId, type, items are required", 400)
  }
  const created = store.createInventoryTransaction({
    organizationId: String(body.organizationId),
    branchId: String(body.branchId),
    warehouseId: body.warehouseId ? String(body.warehouseId) : undefined,
    type: body.type,
    note: body.note ? String(body.note) : undefined,
    items: body.items,
  })
  return ok({ item: created }, { status: 201 })
}

