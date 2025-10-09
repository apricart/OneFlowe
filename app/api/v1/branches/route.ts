import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { store } from "@/lib/store"

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
  const items = store.listBranches(organizationId)
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const err = requireSuperAdmin()
  if (err) return err
  const body = await req.json().catch(() => null)
  if (!body?.name || !body?.code || !body?.organizationId) {
    return NextResponse.json({ error: "name, code, organizationId are required" }, { status: 400 })
  }
  const b = store.createBranch({
    organizationId: String(body.organizationId),
    name: String(body.name),
    code: String(body.code),
    status: (body.status as "active" | "inactive") || "active",
  })
  return NextResponse.json({ item: b }, { status: 201 })
}
