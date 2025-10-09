import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { roles } from "@/db/schema"
import { getCurrentUser } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"

export async function GET() {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    requireRole(current.role, ["SUPER_ADMIN"])
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const data = await db.select({ id: roles.id, name: roles.name }).from(roles)
  return NextResponse.json({ data })
}
