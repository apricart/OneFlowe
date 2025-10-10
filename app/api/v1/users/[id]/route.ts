import { type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword } from "@/lib/password"
import { ok, error, requireApiRole, readJson } from "@/lib/api"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  const patch: any = {}
  if (body.email) patch.email = body.email
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive
  if (body.password) patch.passwordHash = await hashPassword(body.password)
  await db.update(users).set(patch).where(eq(users.id, id))
  return ok({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  await db.delete(users).where(eq(users.id, id))
  return ok({ success: true })
}
