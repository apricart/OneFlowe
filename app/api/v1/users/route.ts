import { okCached as ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { users as usersTable, roles as rolesTable } from "@/db/schema"
import { and, desc, eq, leftJoin } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
type Role = "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN"
import { hashPassword } from "@/lib/password"

export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId")
  const base = db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      phone: usersTable.phone,
      loginCode: usersTable.loginCode,
      mfaEnabled: usersTable.mfaEnabled,
      organizationId: usersTable.organizationId,
      branchId: usersTable.branchId,
      createdAt: usersTable.createdAt,
      role: rolesTable.name,
    })
    .from(usersTable)
    .leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .orderBy(desc(usersTable.createdAt))

  const scope = await getRequestScope()
  const scopedOrgId = scope?.role === "SUPER_ADMIN" ? (organizationId ? Number(organizationId) : undefined) : (scope?.organizationId ?? undefined)
  const rows = scopedOrgId ? await base.where(eq(usersTable.organizationId, scopedOrgId)) : await base

  const items = rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName || "",
    lastName: r.lastName || "",
    phone: r.phone || null,
    loginCode: r.loginCode || null,
    mfaEnabled: !!r.mfaEnabled,
    organizationId: r.organizationId ?? null,
    branchId: r.branchId ?? null,
    createdAt: r.createdAt as any,
    role: r.role || "",
  }))
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err

  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)

  const firstName = String(body.firstName || "")
  const lastName = String(body.lastName || "")
  const email = String(body.email || "")
  const password = String(body.password || "")
  const role = String(body.role || "") as Role
  const organizationId = body.organizationId ? Number(body.organizationId) : null
  const branchId = body.branchId ? Number(body.branchId) : null

  if (!firstName || !lastName || !email || !password || !role) {
    return error("firstName, lastName, email, password, role are required", 400)
  }
  const allowed: Role[] = ["HEAD_OFFICE", "BRANCH_ADMIN"]
  if (!allowed.includes(role)) {
    return error("Only HEAD_OFFICE or BRANCH_ADMIN can be created by Super Admin here", 400)
  }

  if (role === "HEAD_OFFICE") {
    if (!organizationId) return error("organizationId required for HEAD_OFFICE", 400)
  }
  if (role === "BRANCH_ADMIN") {
    if (!organizationId || !branchId) {
      return error("organizationId and branchId required for BRANCH_ADMIN", 400)
    }
  }

  const [roleRow] = await db.select().from(rolesTable).where(eq(rolesTable.name, role)).limit(1)
  if (!roleRow) return error("Invalid role", 400)
  const passwordHash = await hashPassword(password)
  const [item] = await db
    .insert(usersTable)
    .values({
    email,
      passwordHash,
      roleId: roleRow.id,
      firstName,
      lastName,
      phone: body.phone ? String(body.phone) : null,
      loginCode: body.loginCode ? String(body.loginCode) : null,
      mfaEnabled: Boolean(body.mfaEnabled),
    organizationId,
    branchId,
      fullName: `${firstName} ${lastName}`,
  })
    .returning()

  return ok({ item }, { status: 201 })
}
