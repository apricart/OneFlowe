import { store } from "@/lib/store"
import { ok, error, readJson, requireApiRole } from "@/lib/api"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId") || undefined
  const items = store.listBranches(organizationId)
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.name || !body?.code || !body?.organizationId) {
    return error("name, code, organizationId are required", 400)
  }
  const b = store.createBranch({
    organizationId: String(body.organizationId),
    name: String(body.name),
    code: String(body.code),
    status: (body.status as "active" | "inactive") || "active",
  })
  return ok({ item: b }, { status: 201 })
}
