import { ok, error, requireApiRole, readJson } from "@/lib/api"
import { db } from "@/lib/db"
import { organizations as orgsTable } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET() {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const scope = await getRequestScope()
  const where = scope?.role === "SUPER_ADMIN" ? undefined as any : eq(orgsTable.id, Number(scope?.organizationId))
  const items = await db.select().from(orgsTable).where(where).orderBy(desc(orgsTable.createdAt))
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN"]) // Only Super Admin can create organizations
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.name || !body?.code) {
    return error("name and code are required", 400)
  }
  const [item] = await db
    .insert(orgsTable)
    .values({ name: String(body.name), code: String(body.code), status: body?.status ? String(body.status) : undefined })
    .returning()
  return ok({ item }, { status: 201 })
}
