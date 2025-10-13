import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { warehouses } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"]) 
  if (err) return err
  const { id } = await params
  const [item] = await db.select().from(warehouses).where(eq(warehouses.id, Number(id)))
  if (!item) return error("Not found", 404)
  return ok({ item })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"]) 
  if (err) return err
  const { id } = await params
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  const patch: any = {}
  ;["name","code","contact","email","description","isMain"].forEach((k) => { if (k in body) patch[k] = body[k] })
  const [item] = await db.update(warehouses).set(patch).where(eq(warehouses.id, Number(id))).returning()
  return ok({ item })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"]) 
  if (err) return err
  const { id } = await params
  await db.delete(warehouses).where(eq(warehouses.id, Number(id)))
  return ok({ success: true })
}

