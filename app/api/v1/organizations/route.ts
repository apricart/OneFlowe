import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { store } from "@/lib/store"

function requireSuperAdmin() {
  const role = cookies().get("role")?.value
  // NOTE: Replace with robust JWT/RBAC once auth is finalized.
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function GET() {
  const err = requireSuperAdmin()
  if (err) return err
  const items = store.listOrganizations()
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const err = requireSuperAdmin()
  if (err) return err
  const body = await req.json().catch(() => null)
  if (!body?.name || !body?.code) {
    return NextResponse.json({ error: "name and code are required" }, { status: 400 })
  }
  const org = store.createOrganization({
    name: String(body.name),
    code: String(body.code),
    status: (body.status as "active" | "inactive") || "active",
  })
  return NextResponse.json({ item: org }, { status: 201 })
}
