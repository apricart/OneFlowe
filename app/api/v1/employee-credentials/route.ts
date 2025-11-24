import { ok, error, readJson, requireApiRole } from "@/lib/api"
import { db } from "@/lib/db"
import { employeeCredentials, auditLogs } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { hash } from "bcryptjs"
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getRequestScope } from "@/lib/auth";

async function POST(req: NextRequest) {
  try {
    const body = await readJson(req)
    const { email, password, firstName, lastName, mfaEnabled } = body

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

    // Check if email already exists
    const existing = await db
      .select()
      .from(employeeCredentials)
      .where(eq(employeeCredentials.email, email))
      .limit(1)

    if (existing.length > 0) {
      return error("Email already in use", 400)
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

    return ok({ credential: credential }, {status: 201})
  } catch (err: any) {
    console.error("POST /employee-credentials error:", err)
    return error(err.message, 500)
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

    return ok({ credentials: credentials }, {status: 200})
  } catch (err: any) {
    console.error("GET /employee-credentials error:", err)
    return error(err.message, 500)
  }
}

async function PUT(req: NextRequest) {
  try {
    const body = await readJson(req)
    const { id, isActive, firstName, lastName } = body

    if (!id) {
      return error("ID required", 400)
    }

    // Get user scope with proper role and organization/branch info
    const scope = await getRequestScope()
    if (!scope || scope.role !== "BRANCH_ADMIN") {
      return error("Not a branch admin", 403)
    }

    const userBranchId = scope.branchId

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
      return error("Credential not found", 404)
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

    return ok({ credential: updated }, {status: 200})
  } catch (err: any) {
    console.error("PUT /employee-credentials error:", err)
    return error(err.message, 500)
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
      return error("Credential not found", 404)
    }

    await db
      .update(employeeCredentials)
      .set({ isActive: false, deactivatedAt: new Date() })
      .where(eq(employeeCredentials.id, id))

    return ok({ message: "Credential deactivated" }, {status: 200})
  } catch (err: any) {
    console.error("DELETE /employee-credentials error:", err)
    return error(err.message, 500)
  }
}

export { POST, GET, PUT, DELETE };

