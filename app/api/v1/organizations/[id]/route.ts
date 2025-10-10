import { store } from "@/lib/store"
import { ok, error, readJson, requireApiRole } from "@/lib/api"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  const item = store.getOrganization(id)
  if (!item) return error("Not found", 404)
  return ok({ item })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  try {
    const { id } = await params
    const item = store.updateOrganization(id, {
      name: body.name,
      code: body.code,
      status: body.status,
    })
    return ok({ item })
  } catch (e: any) {
    return error(e?.message || "Update failed", 400)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  store.deleteOrganization(id)
  return ok({ ok: true })
}
