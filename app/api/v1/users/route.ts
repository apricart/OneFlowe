import { store, type Role } from "@/lib/store"
import { ok, error, readJson, requireApiRole } from "@/lib/api"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId") || undefined
  const items = store.listUsers(organizationId)
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err

  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)

  const name = String(body.name || "")
  const email = String(body.email || "")
  const role = String(body.role || "") as Role
  const organizationId = body.organizationId ? String(body.organizationId) : null
  const branchId = body.branchId ? String(body.branchId) : null

  if (!name || !email || !role) {
    return error("name, email, role are required", 400)
  }
  const allowed: Role[] = ["HEAD_OFFICE", "BRANCH_ADMIN"]
  if (!allowed.includes(role)) {
    return error("Only HEAD_OFFICE or BRANCH_ADMIN can be created by Super Admin here", 400)
  }

  if (role === "HEAD_OFFICE") {
    if (!organizationId) return error("organizationId required for HEAD_OFFICE", 400)
  }
  if (role === "BRANCH_ADMIN") {
    if (!organizationId || !branchId) {
      return error("organizationId and branchId required for BRANCH_ADMIN", 400)
    }
  }

  const item = store.createUser({
    name,
    email,
    role,
    organizationId,
    branchId,
  })

  return ok({ item }, { status: 201 })
}
