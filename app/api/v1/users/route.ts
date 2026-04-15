export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { users as usersTable, roles as rolesTable, systemLogs, employeeCredentials } from "@/db/schema"
import { and, desc, eq, ne, isNull, or } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
import { headers } from "next/headers"
type Role = "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN" | "ORDER_PORTAL"
import { hashPassword } from "@/lib/password"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"


export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get("organizationId")
    const userRole = (session.user as any).role
    const userOrgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId
    const userId = (session.user as any).id
    
    // Build full tenant user context for 4-tier RBAC
    const tenantUser = {
      role: userRole?.toUpperCase(),
      organizationId: userOrgId ? Number(userOrgId) : null,
      branchId: userBranchId ? Number(userBranchId) : null,
      id: userId || null
    }
    
    const scopedOrgId = userRole === "SUPER_ADMIN" ? (organizationId ? Number(organizationId) : undefined) : userOrgId

    const cacheKey = scopedCacheKey('users', { orgId: scopedOrgId, role: userRole })

    const items = await getCached(cacheKey, async () => {
      return await withTenant(tenantUser, async (tx) => {
        // Note: RBAC is now enforced via PostgreSQL RLS policies
        // We only add application-level filters here
        const conditions: any[] = [ne(rolesTable.name, "SUPER_ADMIN"), isNull(usersTable.deletedAt)]
        
        // Optional: Allow SUPER_ADMIN to filter by specific organization
        if (userRole === "SUPER_ADMIN" && organizationId && /^\d+$/.test(organizationId)) {
          conditions.push(eq(usersTable.organizationId, Number(organizationId)))
        }

        const rows = await tx
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
      })
    }, CACHE_TTL.LISTING)

    return NextResponse.json({ items })
  } catch (err: any) {
    console.error("Users GET error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUserRole = (session.user as any).role
    const userOrgId = (session.user as any).organizationId
    if (currentUserRole !== "SUPER_ADMIN" && currentUserRole !== "HEAD_OFFICE") {
      return NextResponse.json({ error: "Forbidden: Head Office or Super Admin required" }, { status: 403 })
    }

    const body = await req.json()
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

    const firstName = String(body.firstName || "")
    const lastName = String(body.lastName || "")
    const email = String(body.email || "")
    const username = String(body.username || "").toLowerCase()
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
      return NextResponse.json({ error: "firstName, lastName, email, username, password, role are required" }, { status: 400 })
    }

    let allowed: Role[] = []
    if (currentUserRole === "SUPER_ADMIN") {
      allowed = ["HEAD_OFFICE", "BRANCH_ADMIN", "ORDER_PORTAL"]
    } else if (currentUserRole === "HEAD_OFFICE") {
      allowed = ["HEAD_OFFICE", "BRANCH_ADMIN", "ORDER_PORTAL"]
    }

    if (!allowed.includes(role)) {
      return NextResponse.json({ error: `Only ${allowed.join(" or ")} can be created by ${currentUserRole}` }, { status: 400 })
    }

    // Additional validation for HEAD_OFFICE users
    if (currentUserRole === "HEAD_OFFICE") {
      // HEAD_OFFICE can only create users within their own organization
      if (organizationId !== userOrgId) {
        return NextResponse.json({ error: "You can only create users within your own organization" }, { status: 403 })
      }
    }

    if (role === "HEAD_OFFICE") {
      if (!organizationId) return NextResponse.json({ error: "organizationId required for HEAD_OFFICE" }, { status: 400 })
    }
    if (role === "BRANCH_ADMIN" || role === "ORDER_PORTAL") {
      if (!organizationId || !branchId) {
        return NextResponse.json({ error: "organizationId and branchId required for BRANCH_ADMIN and ORDER_PORTAL" }, { status: 400 })
      }
    }

    const [roleRow] = await withSuperAdmin(async (tx) => 
      tx.select().from(rolesTable).where(eq(rolesTable.name, role)).limit(1)
    ) as any[]

    if (!roleRow) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // MFA is handled separately through the MFA system
    // No login code generation needed
    const passwordHash = await hashPassword(password)

    // Username uniqueness is enforced by DB unique index and the check-username API
    // We use withSuperAdmin for checking across all tenants
    const [existingUsernameUser] = await withSuperAdmin(async (tx) => 
      tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, username))
        .limit(1)
    ) as any[]

    const [existingUsernameEmp] = await withSuperAdmin(async (tx) => 
      tx
        .select({ id: employeeCredentials.id })
        .from(employeeCredentials)
        .where(eq(employeeCredentials.username, username))
        .limit(1)
    ) as any[]

    if (existingUsernameUser || existingUsernameEmp) {
      return NextResponse.json({ error: "Username already exists. Please choose a different username." }, { status: 400 })
    }

    const [item] = await withTenant(session.user as any, async (tx) => 
      tx
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
          mustChangePassword: true,
          passwordExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
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
    ) as any[]

    const createdUser = item

    // Audit Log
    try {
      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const forwardedFor = headersList.get("x-forwarded-for")
      const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown"

      await withTenant(session.user as any, async (tx) => 
        tx.insert(systemLogs).values({
          userId: (session.user as any).id,
          userRole: currentUserRole,
          organizationId: userOrgId,
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
      )
    } catch (logErr) {
      console.error("[DEBUG] Failed to write audit log:", logErr)
    }

    // Invalidate users cache so lists refresh immediately
    await invalidateByPrefix('users')

    return NextResponse.json({ item: createdUser }, { status: 201 })
  } catch (err: any) {
    const errorCode = String(err.code || "")
    const errorMsg = String(err.message || "").toLowerCase()

    if (errorCode === '23505' || errorMsg.includes('unique constraint')) {
        if (errorMsg.includes('username')) return NextResponse.json({ error: "Username already exists." }, { status: 400 })
        if (errorMsg.includes('email')) return NextResponse.json({ error: "Email exists." }, { status: 400 })
        return NextResponse.json({ error: "Unique conflict" }, { status: 400 })
    }

    console.error("User POST error:", err)
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 })
  }
}
