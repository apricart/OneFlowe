import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { warehouses } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId")
  const branchId = searchParams.get("branchId")
  const isMain = searchParams.get("isMain")
  const where = [
    organizationId ? eq(warehouses.organizationId, Number(organizationId)) : undefined,
    branchId ? eq(warehouses.branchId, Number(branchId)) : undefined,
    isMain === null ? undefined : eq(warehouses.isMain, isMain === "true"),
  ].filter(Boolean) as any
  try {
    const items = await db
      .select()
      .from(warehouses)
      .where(where.length ? and(...where) : (undefined as any))
      .orderBy(desc(warehouses.createdAt))
    return ok({ items })
  } catch (e: any) {
    if (e?.code === '42P01') {
      return ok({ items: [] })
    }
    throw e
  }
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.organizationId || !body?.branchId || !body?.name || !body?.code) {
    return error("organizationId, branchId, name, code are required", 400)
  }
  const [item] = await db
    .insert(warehouses)
    .values({
      organizationId: Number(body.organizationId),
      branchId: Number(body.branchId),
      name: String(body.name),
      code: String(body.code),
      contact: body.contact ? String(body.contact) : null,
      email: body.email ? String(body.email) : null,
      description: body.description ? String(body.description) : null,
      isMain: Boolean(body.isMain),
    })
    .returning()
  return ok({ item }, { status: 201 })
}

