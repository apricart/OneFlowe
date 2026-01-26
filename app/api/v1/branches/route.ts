import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { branches as branchesTable } from "@/db/schema"
import { and, desc, eq, sql } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
    if (err) return err
    const { searchParams } = new URL(req.url)
    const organizationIdRaw = searchParams.get("organizationId") || undefined
    const orgIdNum = organizationIdRaw && /^\d+$/.test(organizationIdRaw) ? Number(organizationIdRaw) : undefined
    const scope = await getRequestScope()
    const scopedOrgId = scope?.role === "SUPER_ADMIN" ? orgIdNum : (scope?.organizationId ?? undefined)
    const scopedBranchId = scope?.role === "BRANCH_ADMIN" ? scope?.branchId : undefined

    const items = await db
      .select({
        id: branchesTable.id,
        organizationId: branchesTable.organizationId,
        name: branchesTable.name,
        code: branchesTable.code,
        status: branchesTable.status,
        groupId: branchesTable.groupId,
        adminUserId: branchesTable.adminUserId,
        createdAt: branchesTable.createdAt,
        updatedAt: branchesTable.updatedAt,
        groupName: sql<string | null>`(
          SELECT name FROM groups WHERE id = ${branchesTable.groupId}
        )`,
      })
      .from(branchesTable)
      .where(and(
        scopedOrgId ? eq(branchesTable.organizationId, scopedOrgId) : undefined,
        scopedBranchId ? eq(branchesTable.id, scopedBranchId) : undefined
      ))
      .orderBy(desc(branchesTable.createdAt))
    return ok({ items })
  } catch (e: any) {
    console.error("Error in GET /api/v1/branches:", e)
    return error(e instanceof Error ? e.message : String(e), 500)
  }
}

export async function POST(req: Request) {
  try {
    const err = await requireApiRole(["SUPER_ADMIN"])
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
  } catch (e: any) {
    console.error("Error in POST /api/v1/branches:", e)
    return error(e instanceof Error ? e.message : String(e), 500)
  }
}
