import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { users as usersTable, roles as rolesTable, systemLogs, employeeCredentials } from "@/db/schema"
import { and, desc, eq, ne, isNull, or } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
import { headers } from "next/headers"
type Role = "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN" | "ORDER_PORTAL"
import { hashPassword } from "@/lib/password"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"


export async function GET(req: Request) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId")
  const scope = await getRequestScope()
  const scopedOrgId = scope?.role === "SUPER_ADMIN" ? (organizationId ? Number(organizationId) : undefined) : (scope?.organizationId ?? undefined)

  const cacheKey = scopedCacheKey('users', { orgId: scopedOrgId, role: scope?.role })

  const items = await getCached(cacheKey, async () => {
    const conditions = [ne(rolesTable.name, "SUPER_ADMIN"), isNull(usersTable.deletedAt)]
    if (scopedOrgId) {
      conditions.push(eq(usersTable.organizationId, scopedOrgId))
    }

    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        username: usersTable.username,
        location: usersTable.location,
        phone: usersTable.phone,
        mfaEnabled: usersTable.mfaEnabled,
        organizationId: usersTable.organizationId,
        branchId: usersTable.branchId,
        createdAt: usersTable.createdAt,
        role: rolesTable.name,
        isActive: usersTable.isActive,
        employeeId: usersTable.employeeId,
        imprestHolder: usersTable.imprestHolder,
        contactPerson: usersTable.contactPerson,
        address: usersTable.address,
      })
      .from(usersTable)
      .leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(and(...conditions))
      .orderBy(desc(usersTable.createdAt))

    return rows.map((r: any) => ({
      id: r.id,
      email: r.email,
      firstName: r.firstName || "",
      lastName: r.lastName || "",
      username: r.username || "",
      location: r.location || null,
      phone: r.phone || null,
      mfaEnabled: !!r.mfaEnabled,
      organizationId: r.organizationId ?? null,
      branchId: r.branchId ?? null,
      createdAt: r.createdAt as any,
      role: r.role || "",
      isActive: !!r.isActive,
      employeeId: r.employeeId || null,
      imprestHolder: r.imprestHolder || null,
      contactPerson: r.contactPerson || null,
      address: r.address || null,
    }))
  }, CACHE_TTL.LISTING)

  return ok({ items })
}

export async function POST(req: Request) {
  console.log("[API/Users] POST /api/v1/users triggered")
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err

  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)

  const firstName = String(body.firstName || "")
  const lastName = String(body.lastName || "")
  const email = String(body.email || "")
  const username = String(body.username || "").toLowerCase().trim()
  const location = String(body.location || "")
  const password = String(body.password || "")
  const role = String(body.role || "") as Role
  const parseId = (val: any) => {
    if (val === null || val === undefined || val === "") return null
    const n = Number(val)
    return Number.isNaN(n) ? null : n
  }

  const organizationId = parseId(body.organizationId)
  const branchId = parseId(body.branchId)

  if (!firstName || !lastName || !email || !username || !password || !role) {
    return error("firstName, lastName, email, username, password, role are required", 400)
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

    // Username uniqueness is enforced by DB unique index and the check-username API
    const [existingUsernameUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1)

    const [existingUsernameEmp] = await db
      .select({ id: employeeCredentials.id })
      .from(employeeCredentials)
      .where(eq(employeeCredentials.username, username))
      .limit(1)

    if (existingUsernameUser || existingUsernameEmp) {
      return error("Username already exists. Please choose a different username.", 400)
    }

    const [item] = await db
      .insert(usersTable)
      .values({
        email,
        username,
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
        employeeId: body.employeeId ? String(body.employeeId) : null,
        imprestHolder: body.imprestHolder ? String(body.imprestHolder) : null,
        contactPerson: body.contactPerson ? String(body.contactPerson) : null,
        location: location || null,
        address: body.address ? String(body.address) : null,
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
          createdUserUsername: createdUser.username,
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

    // Invalidate users cache so lists refresh immediately
    await invalidateByPrefix('users')

    return ok({ item: createdUser }, { status: 201 })
  } catch (err: any) {
    // Catch validation errors from password hashing or unique constraints
    const errorCode = String(err.code || err.cause?.code || "")
    const errorMsg = String(err.message || "").toLowerCase()
    const detail = String(err.detail || err.cause?.detail || "").toLowerCase()

    if (errorCode === '23505' || errorMsg.includes('unique constraint') || detail.includes('already exists')) {
      if (detail.includes('email') || errorMsg.includes('email')) {
        return error("Email address already exists. Please use a different email.", 400)
      }
      return error("Username already exists. Please choose a different username.", 400)
    }

    // Pass through validation errors as 400
    if (errorMsg.includes("invalid password") || errorMsg.includes("must contain")) {
      return error(err.message, 400)
    }

    // Only log actual unexpected errors
    console.error("[USERS_API] Unexpected error creating user:", err)
    return error(err.message || "Failed to create user", 500)
  }
}
