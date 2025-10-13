import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { branches } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { id } = await params
  const [item] = await db.select().from(branches).where(eq(branches.id, Number(id)))
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
    if (body.status) patch.status = String(body.status)
    const [item] = await db.update(branches).set(patch).where(eq(branches.id, Number(id))).returning()
    return ok({ item })
  } catch (e: any) {
    return error(e?.message || "Update failed", 400)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  await db.delete(branches).where(eq(branches.id, Number(id)))
  return ok({ ok: true })
}
