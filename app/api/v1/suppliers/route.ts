import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { suppliers } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"]) 
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId")
  const branchId = searchParams.get("branchId")
  const where = [
    organizationId ? eq(suppliers.organizationId, Number(organizationId)) : undefined,
    branchId ? eq(suppliers.branchId, Number(branchId)) : undefined,
  ].filter(Boolean) as any
  try {
    const items = await db
      .select()
      .from(suppliers)
      .where(where.length ? and(...where) : (undefined as any))
      .orderBy(desc(suppliers.createdAt))
    return ok({ items })
  } catch (e: any) {
    if (e?.code === '42P01') {
      // relation does not exist (migrations not applied yet)
      return ok({ items: [] })
    }
    throw e
  }
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"]) 
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.organizationId || !body?.branchId || !body?.name) {
    return error("organizationId, branchId, name are required", 400)
  }
  const [item] = await db
    .insert(suppliers)
    .values({
      organizationId: Number(body.organizationId),
      branchId: Number(body.branchId),
      name: String(body.name),
      address: body.address ? String(body.address) : null,
      contact: body.contact ? String(body.contact) : null,
      email: body.email ? String(body.email) : null,
      description: body.description ? String(body.description) : null,
    })
    .returning()
  return ok({ item }, { status: 201 })
}

