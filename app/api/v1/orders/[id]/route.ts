import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { orders } from "@/db/schema"
import { eq } from "drizzle-orm"
type OrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { id } = await params
  const [item] = await db.select().from(orders).where(eq(orders.id, Number(id)))
  if (!item) return error("Not found", 404)
  return ok({ item })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Head Office approves/rejects; Super Admin can mark fulfilled
  const err = await requireApiRole(["HEAD_OFFICE", "SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  const allowedStatuses: OrderStatus[] = ["APPROVED", "REJECTED", "FULFILLED", "PENDING"]
  if (body.status && !allowedStatuses.includes(body.status)) {
    return error("Invalid status", 400)
  }
  const patch: any = {}
  if (body.status) patch.status = String(body.status)
  const [item] = await db.update(orders).set(patch).where(eq(orders.id, Number(id))).returning()
  return ok({ item })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const { id } = await params
  await db.delete(orders).where(eq(orders.id, Number(id)))
  return ok({ success: true })
}

