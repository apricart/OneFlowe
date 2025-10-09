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

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const err = requireSuperAdmin()
  if (err) return err
  const item = store.getOrganization(params.id)
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ item })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const err = requireSuperAdmin()
  if (err) return err
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  try {
    const item = store.updateOrganization(params.id, {
      name: body.name,
      code: body.code,
      status: body.status,
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const err = requireSuperAdmin()
  if (err) return err
  store.deleteOrganization(params.id)
  return NextResponse.json({ ok: true })
}
