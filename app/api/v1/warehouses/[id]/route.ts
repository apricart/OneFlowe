import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { store } from "@/lib/store"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"]) 
  if (err) return err
  const { id } = await params
  const item = store.getWarehouse(id)
  if (!item) return error("Not found", 404)
  return ok({ item })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"]) 
  if (err) return err
  const { id } = await params
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  const updated = store.updateWarehouse(id, body)
  return ok({ item: updated })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"]) 
  if (err) return err
  const { id } = await params
  store.deleteWarehouse(id)
  return ok({ success: true })
}
