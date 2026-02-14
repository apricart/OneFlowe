import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { users as usersTable, roles as rolesTable, systemLogs } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
import { headers } from "next/headers"
type Role = "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN" | "ORDER_PORTAL"
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
      mfaEnabled: usersTable.mfaEnabled,
      organizationId: usersTable.organizationId,
      branchId: usersTable.branchId,
      createdAt: usersTable.createdAt,
      role: rolesTable.name,
      isActive: usersTable.isActive,
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
    mfaEnabled: !!r.mfaEnabled,
    organizationId: r.organizationId ?? null,
    branchId: r.branchId ?? null,
    createdAt: r.createdAt as any,
    role: r.role || "",
    isActive: !!r.isActive,
  }))
  return ok({ items })
}

export async function POST(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err

  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)

  const firstName = String(body.firstName || "")
  const lastName = String(body.lastName || "")
  const email = String(body.email || "")
  const password = String(body.password || "")
  const role = String(body.role || "") as Role
  const parseId = (val: any) => {
    if (val === null || val === undefined || val === "") return null
    const n = Number(val)
    return Number.isNaN(n) ? null : n
  }

  const organizationId = parseId(body.organizationId)
  const branchId = parseId(body.branchId)

  if (!firstName || !lastName || !email || !password || !role) {
    return error("firstName, lastName, email, password, role are required", 400)
  }
  // Get the current user's role to determine what roles they can create
  const scope = await getRequestScope()
  const currentUserRole = scope?.role

  let allowed: Role[] = []
  if (currentUserRole === "SUPER_ADMIN") {
    allowed = ["HEAD_OFFICE", "BRANCH_ADMIN", "ORDER_PORTAL"]
  } else if (currentUserRole === "HEAD_OFFICE") {
    allowed = ["HEAD_OFFICE", "BRANCH_ADMIN", "ORDER_PORTAL"]
  }

  if (!allowed.includes(role)) {
    console.error("[DEBUG] Role not allowed:", { role, currentUserRole, allowed })
    return error(`Only ${allowed.join(" or ")} can be created by ${currentUserRole}`, 400)
  }

  // Additional validation for HEAD_OFFICE users
  if (currentUserRole === "HEAD_OFFICE") {
    // HEAD_OFFICE can only create users within their own organization
    if (organizationId !== scope?.organizationId) {
      return error("You can only create users within your own organization", 403)
    }
  }

  if (role === "HEAD_OFFICE") {
    if (!organizationId) return error("organizationId required for HEAD_OFFICE", 400)
  }
  if (role === "BRANCH_ADMIN" || role === "ORDER_PORTAL") {
    if (!organizationId || !branchId) {
      return error("organizationId and branchId required for BRANCH_ADMIN and ORDER_PORTAL", 400)
    }
  }

  const [roleRow] = await db.select().from(rolesTable).where(eq(rolesTable.name, role)).limit(1)
  if (!roleRow) {
    console.error("[DEBUG] Role row not found for name:", role)
    return error("Invalid role", 400)
  }

  // MFA is handled separately through the MFA system
  // No login code generation needed

  try {
    console.log("[USERS_API] Starting user creation for email:", email)
    const passwordHash = await hashPassword(password)
    console.log("[USERS_API] Password hashed successfully")

    // Pre-emptive check for existing user with the same email
    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1)

    if (existingUser) {
      return error("Email address already exists. Please use a different email.", 400)
    }

    const [item] = await db
      .insert(usersTable)
      .values({
        email,
        passwordHash,
        roleId: roleRow.id,
        firstName,
        lastName,
        phone: body.phone ? String(body.phone) : null,
        mfaEnabled: Boolean(body.mfaEnabled),
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        organizationId,
        branchId,
        fullName: `${firstName} ${lastName}`,
      })
      .returning()

    const createdUser = item

    // Audit Log
    try {
      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const forwardedFor = headersList.get("x-forwarded-for")
      const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown"

      await db.insert(systemLogs).values({
        userId: scope?.userId,
        userRole: currentUserRole,
        organizationId: scope?.organizationId,
        branchId: branchId || undefined,
        action: "USER_CREATE",
        resourceType: "user",
        resourceId: String(createdUser.id),
        details: {
          createdUserEmail: createdUser.email,
          createdUserRole: role,
          createdUserOrgId: organizationId,
          createdUserBranchId: branchId
        },
        ipAddress: ip,
        userAgent: userAgent,
        success: true
      })
    } catch (logErr) {
      console.error("[DEBUG] Failed to write audit log:", logErr)
    }

    return ok({ item: createdUser }, { status: 201 })
  } catch (err: any) {
    // Catch validation errors from password hashing or unique constraints
    const errorCode = String(err.code || err.cause?.code || "")
    const errorMsg = String(err.message || "").toLowerCase()
    const detail = String(err.detail || err.cause?.detail || "").toLowerCase()

    if (errorCode === '23505' || errorMsg.includes('unique constraint') || detail.includes('already exists')) {
      return error("Email address already exists. Please use a different email.", 400)
    }

    // Pass through validation errors as 400
    if (errorMsg.includes("invalid password") || errorMsg.includes("must contain")) {
      return error(err.message, 400)
    }

    // Only log actual unexpected errors
    console.error("[USERS_API] Unexpected error creating user:", err)
    return error("Failed to create user", 500)
  }
}
