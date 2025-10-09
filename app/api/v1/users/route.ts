import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { store, type Role } from "@/lib/store"

function requireSuperAdmin() {
  const role = cookies().get("role")?.value
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function GET(req: Request) {
  const err = requireSuperAdmin()
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId") || undefined
  const items = store.listUsers(organizationId)
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const err = requireSuperAdmin()
  if (err) return err

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const name = String(body.name || "")
  const email = String(body.email || "")
  const role = String(body.role || "") as Role
  const organizationId = body.organizationId ? String(body.organizationId) : null
  const branchId = body.branchId ? String(body.branchId) : null

  if (!name || !email || !role) {
    return NextResponse.json({ error: "name, email, role are required" }, { status: 400 })
  }
  const allowed: Role[] = ["HEAD_OFFICE", "BRANCH_ADMIN"]
  if (!allowed.includes(role)) {
    return NextResponse.json(
      { error: "Only HEAD_OFFICE or BRANCH_ADMIN can be created by Super Admin here" },
      { status: 400 },
    )
  }

  // Role-based validation
  if (role === "HEAD_OFFICE") {
    if (!organizationId) return NextResponse.json({ error: "organizationId required for HEAD_OFFICE" }, { status: 400 })
  }
  if (role === "BRANCH_ADMIN") {
    if (!organizationId || !branchId) {
      return NextResponse.json({ error: "organizationId and branchId required for BRANCH_ADMIN" }, { status: 400 })
    }
  }

  const item = store.createUser({
    name,
    email,
    role,
    organizationId,
    branchId,
  })

  return NextResponse.json({ item }, { status: 201 })
}
