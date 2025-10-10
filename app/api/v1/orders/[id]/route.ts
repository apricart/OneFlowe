import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { store, type OrderStatus } from "@/lib/store"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { id } = await params
  const item = store.getOrder(id)
  if (!item) return error("Not found", 404)
  return ok({ item })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Head Office approves/rejects; Super Admin can mark fulfilled
  const err = await requireApiRole(["HEAD_OFFICE", "SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  const allowedStatuses: OrderStatus[] = ["APPROVED", "REJECTED", "FULFILLED", "PENDING"]
  if (body.status && !allowedStatuses.includes(body.status)) {
    return error("Invalid status", 400)
  }
  const updated = store.updateOrder(id, {
    status: body.status as OrderStatus | undefined,
    note: body.note,
    items: body.items,
  })
  return ok({ item: updated })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  store.deleteOrder(id)
  return ok({ success: true })
}
