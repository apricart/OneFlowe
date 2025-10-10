import { store } from "@/lib/store"
import { ok, error, requireApiRole, readJson } from "@/lib/api"

export async function GET() {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const items = store.listOrganizations()
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.name || !body?.code) {
    return error("name and code are required", 400)
  }
  const org = store.createOrganization({
    name: String(body.name),
    code: String(body.code),
    status: (body.status as "active" | "inactive") || "active",
  })
  return ok({ item: org }, { status: 201 })
}
