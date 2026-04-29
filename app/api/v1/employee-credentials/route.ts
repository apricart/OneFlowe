import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { employeeCredentials, auditLogs } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { hash } from "bcryptjs"
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getRequestScope } from "@/lib/auth";
import { assertUniqueUserFields, normalizeEmail, UserUniqueFieldError } from "@/lib/user-uniqueness";

async function POST(req: NextRequest) {
  try {
    const body = await readJson(req)
    const { password, firstName, lastName, mfaEnabled } = body
    const email = normalizeEmail(body.email)

    if (!email || !password) {
      return error("Email and password required", 400)
    }

    // Get user scope with proper role and organization/branch info
    const scope = await getRequestScope()
    if (!scope || scope.role !== "BRANCH_ADMIN") {
      return error("Not a branch admin", 403)
    }

    const userBranchId = scope.branchId
    const orgId = scope.organizationId

    if (!userBranchId || !orgId) {
      return error("Branch admin must be assigned to a branch", 403)
    }

    await assertUniqueUserFields({ email })

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
        createdByUserId: scope.userId,
      })
      .returning()

    // Log action
    await db.insert(auditLogs).values({
      userId: scope.userId,
      organizationId: orgId,
      action: "CREATE_EMPLOYEE_CREDENTIAL",
      entity: "EMPLOYEE_CREDENTIAL",
      entityId: String(credential.id),
      metadata: {
        email,
        branchId: userBranchId,
      },
    })

    return ok({ credential: credential }, { status: 201 })
  } catch (err: any) {
    if (err instanceof UserUniqueFieldError) {
      return error(err.message, 400)
    }
    console.error("POST /employee-credentials error:", err)
    return error("Internal Server Error", 500)
  }
}

async function GET(req: NextRequest) {
  try {
    // Get user scope with proper role and organization/branch info
    const scope = await getRequestScope()
    if (!scope || scope.role !== "BRANCH_ADMIN") {
      return error("Not a branch admin", 403)
    }

    const userBranchId = scope.branchId
    const orgId = scope.organizationId

    if (!userBranchId || !orgId) {
      return error("Branch admin must be assigned to a branch", 403)
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

    return ok({ credentials: credentials }, { status: 200 })
  } catch (err: any) {
    console.error("GET /employee-credentials error:", err)
    return error("Internal Server Error", 500)
  }
}

async function PUT(req: NextRequest) {
  try {
    const body = await readJson(req)
    const { id, isActive, firstName, lastName, password } = body
    const email = body.email !== undefined ? normalizeEmail(body.email) : undefined

    if (!id) {
      return error("ID required", 400)
    }

    const credId = typeof id === 'number' ? id : parseInt(id, 10)
    if (isNaN(credId)) {
      return error("Invalid ID format", 400)
    }

    // Get user scope with proper role and organization/branch info
    const scope = await getRequestScope()
    if (!scope || scope.role !== "BRANCH_ADMIN") {
      return error("Not a branch admin", 403)
    }

    const userBranchId = scope.branchId
    if (!userBranchId) {
      return error("Branch admin must be assigned to a branch", 403)
    }

    // Verify ownership
    const [cred] = await db
      .select()
      .from(employeeCredentials)
      .where(
        and(
          eq(employeeCredentials.id, credId),
          eq(employeeCredentials.branchId, userBranchId)
        )
      )

    if (!cred) {
      return error("Credential not found", 404)
    }

    const updates: any = {}
    if (isActive !== undefined) updates.isActive = isActive
    if (firstName !== undefined) updates.firstName = firstName
    if (lastName !== undefined) updates.lastName = lastName

    // Handle email update
    if (email && email !== cred.email) {
      await assertUniqueUserFields({ email }, undefined, credId)
      updates.email = email
    }

    // Handle password update
    if (password) {
      // Validate password complexity
      if (password.length < 12) {
        return error("Password must be at least 12 characters", 400)
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
        return error("Password must include uppercase, lowercase, number, and special character", 400)
      }
      updates.passwordHash = await hash(password, 10)
    }

    // Only password changes should invalidate the current session.
    const securityChange = !!password
    const nextVersion = securityChange
      ? (cred.sessionVersion || 0) + 1
      : (cred.sessionVersion || 0)

    const [updated] = await db
      .update(employeeCredentials)
      .set({ ...updates, sessionVersion: nextVersion })
      .where(eq(employeeCredentials.id, credId))
      .returning()

    return ok({ credential: updated, sessionInvalidated: securityChange }, { status: 200 })
  } catch (err: any) {
    if (err instanceof UserUniqueFieldError) {
      return error(err.message, 400)
    }
    console.error("PUT /employee-credentials error:", err)
    return error("Internal Server Error", 500)
  }
}

async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")

    if (!id) {
      return error("ID required", 400)
    }

    // Get user scope with proper role and organization/branch info
    const scope = await getRequestScope()
    if (!scope || scope.role !== "BRANCH_ADMIN") {
      return error("Not a branch admin", 403)
    }

    const userBranchId = scope.branchId

    if (!userBranchId) {
      return error("Branch admin must be assigned to a branch", 403)
    }

    const credId = parseInt(id, 10)
    if (isNaN(credId)) {
      return error("Invalid ID format", 400)
    }

    // Verify ownership
    const [cred] = await db
      .select()
      .from(employeeCredentials)
      .where(
        and(
          eq(employeeCredentials.id, credId),
          eq(employeeCredentials.branchId, userBranchId)
        )
      )

    if (!cred) {
      return error("Credential not found", 404)
    }

    await db
      .update(employeeCredentials)
      .set({ isActive: false, deactivatedAt: new Date() })
      .where(eq(employeeCredentials.id, credId))

    return ok({ message: "Credential deactivated" }, { status: 200 })
  } catch (err: any) {
    console.error("DELETE /employee-credentials error:", err)
    return error("Internal Server Error", 500)
  }
}

export { POST, GET, PUT, DELETE };

