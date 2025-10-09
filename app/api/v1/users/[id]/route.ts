import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { hashPassword } from "@/lib/password"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    requireRole(current.role, ["SUPER_ADMIN"])
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { email, password, isActive } = await req.json()
  const patch: any = {}
  if (email) patch.email = email
  if (typeof isActive === "boolean") patch.isActive = isActive
  if (password) patch.passwordHash = await hashPassword(password)

  await db.update(users).set(patch).where(eq(users.id, params.id))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    requireRole(current.role, ["SUPER_ADMIN"])
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.delete(users).where(eq(users.id, params.id))
  return NextResponse.json({ success: true })
}
