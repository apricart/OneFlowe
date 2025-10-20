import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { employeeCredentials, auditLogs } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { hash } from "bcryptjs"

export const POST = requireApiRole(["BRANCH_ADMIN"], async (req, session) => {
  try {
    const body = await readJson(req)
    const { email, password, firstName, lastName, mfaEnabled } = body

    if (!email || !password) {
      return error(400, "Email and password required")
    }

    const userSession = session as any
    const userBranchId = userSession.branchId
    const orgId = userSession.organizationId

    if (!userBranchId || !orgId) {
      return error(403, "Not a branch admin")
    }

    // Check if email already exists
    const existing = await db
      .select()
      .from(employeeCredentials)
      .where(eq(employeeCredentials.email, email))
      .limit(1)

    if (existing.length > 0) {
      return error(400, "Email already in use")
    }

    // Hash password
    const passwordHash = await hash(password, 10)

    // Create employee credential
    const [credential] = await db
      .insert(employeeCredentials)
      .values({
        branchId: userBranchId,
        organizationId: orgId,
        email,
        passwordHash,
        firstName: firstName || "",
        lastName: lastName || "",
        mfaEnabled: mfaEnabled || false,
        createdByUserId: userSession.userId,
      })
      .returning()

    // Log action
    await db.insert(auditLogs).values({
      userId: userSession.userId,
      organizationId: orgId,
      action: "CREATE_EMPLOYEE_CREDENTIAL",
      entity: "EMPLOYEE_CREDENTIAL",
      entityId: String(credential.id),
      metadata: {
        email,
        branchId: userBranchId,
      },
    })

    return ok(201, { credential })
  } catch (err: any) {
    console.error("POST /employee-credentials error:", err)
    return error(500, err.message)
  }
})

export const GET = requireApiRole(["BRANCH_ADMIN"], async (req, session) => {
  try {
    const userSession = session as any
    const userBranchId = userSession.branchId
    const orgId = userSession.organizationId

    if (!userBranchId || !orgId) {
      return error(403, "Not a branch admin")
    }

    const credentials = await db
      .select({
        id: employeeCredentials.id,
        email: employeeCredentials.email,
        firstName: employeeCredentials.firstName,
        lastName: employeeCredentials.lastName,
        mfaEnabled: employeeCredentials.mfaEnabled,
        isActive: employeeCredentials.isActive,
        createdAt: employeeCredentials.createdAt,
      })
      .from(employeeCredentials)
      .where(
        and(
          eq(employeeCredentials.branchId, userBranchId),
          eq(employeeCredentials.organizationId, orgId)
        )
      )

    return ok(200, { credentials })
  } catch (err: any) {
    console.error("GET /employee-credentials error:", err)
    return error(500, err.message)
  }
})

export const PUT = requireApiRole(["BRANCH_ADMIN"], async (req, session) => {
  try {
    const body = await readJson(req)
    const { id, isActive, firstName, lastName } = body

    if (!id) {
      return error(400, "ID required")
    }

    const userSession = session as any
    const userBranchId = userSession.branchId

    // Verify ownership
    const [cred] = await db
      .select()
      .from(employeeCredentials)
      .where(
        and(
          eq(employeeCredentials.id, id),
          eq(employeeCredentials.branchId, userBranchId)
        )
      )

    if (!cred) {
      return error(404, "Credential not found")
    }

    const updates: any = {}
    if (isActive !== undefined) updates.isActive = isActive
    if (firstName !== undefined) updates.firstName = firstName
    if (lastName !== undefined) updates.lastName = lastName

    const [updated] = await db
      .update(employeeCredentials)
      .set(updates)
      .where(eq(employeeCredentials.id, id))
      .returning()

    return ok(200, { credential: updated })
  } catch (err: any) {
    console.error("PUT /employee-credentials error:", err)
    return error(500, err.message)
  }
})

export const DELETE = requireApiRole(["BRANCH_ADMIN"], async (req, session) => {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")

    if (!id) {
      return error(400, "ID required")
    }

    const userSession = session as any
    const userBranchId = userSession.branchId

    // Verify ownership
    const [cred] = await db
      .select()
      .from(employeeCredentials)
      .where(
        and(
          eq(employeeCredentials.id, Number(id)),
          eq(employeeCredentials.branchId, userBranchId)
        )
      )

    if (!cred) {
      return error(404, "Credential not found")
    }

    await db
      .update(employeeCredentials)
      .set({ isActive: false, deactivatedAt: new Date() })
      .where(eq(employeeCredentials.id, Number(id)))

    return ok(200, { message: "Credential deactivated" })
  } catch (err: any) {
    console.error("DELETE /employee-credentials error:", err)
    return error(500, err.message)
  }
})
