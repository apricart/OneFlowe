import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { store } from "@/lib/store"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId") || undefined
  const branchId = searchParams.get("branchId") || undefined
  const isMain = searchParams.get("isMain")
  const items = store.listWarehouses({
    organizationId,
    branchId,
    isMain: isMain === null ? undefined as any : isMain === "true",
  } as any)
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.organizationId || !body?.branchId || !body?.name || !body?.code) {
    return error("organizationId, branchId, name, code are required", 400)
  }
  const created = store.createWarehouse({
    organizationId: String(body.organizationId),
    branchId: String(body.branchId),
    name: String(body.name),
    code: String(body.code),
    contact: body.contact ? String(body.contact) : undefined,
    email: body.email ? String(body.email) : undefined,
    description: body.description ? String(body.description) : undefined,
    isMain: Boolean(body.isMain),
  })
  return ok({ item: created }, { status: 201 })
}

