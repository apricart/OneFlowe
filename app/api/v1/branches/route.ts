import { okCached as ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { branches as branchesTable } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationIdRaw = searchParams.get("organizationId") || undefined
  const orgIdNum = organizationIdRaw && /^\d+$/.test(organizationIdRaw) ? Number(organizationIdRaw) : undefined
  const scope = await getRequestScope()
  const scopedOrgId = scope?.role === "SUPER_ADMIN" ? orgIdNum : (scope?.organizationId ?? undefined)
  const items = await db
    .select()
    .from(branchesTable)
    .where(scopedOrgId ? eq(branchesTable.organizationId, scopedOrgId) : undefined as any)
    .orderBy(desc(branchesTable.createdAt))
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN"]) // Only Super Admin can create branches
  if (err) return err
  const body = await readJson<any>(req)
  if (!body?.name || !body?.code || !body?.organizationId) {
    return error("name, code, organizationId are required", 400)
  }
  const [item] = await db
    .insert(branchesTable)
    .values({
      organizationId: Number(body.organizationId),
      name: String(body.name),
      code: String(body.code),
      status: String(body.status || "active"),
    })
    .returning()
  return ok({ item }, { status: 201 })
}
