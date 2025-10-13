import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { organizations } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { id } = await params
  const [item] = await db.select().from(organizations).where(eq(organizations.id, Number(id)))
  if (!item) return error("Not found", 404)
  return ok({ item })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  try {
    const { id } = await params
    const patch: any = {}
    if (body.name) patch.name = String(body.name)
    if (body.code) patch.code = String(body.code)
    const [item] = await db.update(organizations).set(patch).where(eq(organizations.id, Number(id))).returning()
    return ok({ item })
  } catch (e: any) {
    return error(e?.message || "Update failed", 400)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  await db.delete(organizations).where(eq(organizations.id, Number(id)))
  return ok({ ok: true })
}
