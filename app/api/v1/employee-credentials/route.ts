import { db, withTenant } from "@/lib/db"
import { employeeCredentials, auditLogs } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { hash } from "bcryptjs"
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if ((session.user as any).role !== "BRANCH_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Branch Admin access required" }, { status: 403 })
    }

    const { email, password, firstName, lastName, mfaEnabled } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })
    }

    const userBranchId = (session.user as any).branchId
    const orgId = (session.user as any).organizationId

    if (!userBranchId || !orgId) {
      return NextResponse.json({ error: "Branch admin must be assigned to a branch" }, { status: 403 })
    }

    const result = await withTenant(session.user as any, async (tx) => {
      // Check if email already exists
      const [existing] = await tx
        .select()
        .from(employeeCredentials)
        .where(eq(employeeCredentials.email, email))
        .limit(1)

      if (existing) {
        throw new Error("Email already in use")
      }

      // Hash password
      const passwordHash = await hash(password, 10)

      // Create employee credential
      const [credential] = await tx
        .insert(employeeCredentials)
        .values({
          branchId: userBranchId,
          organizationId: orgId,
          email,
          passwordHash,
          firstName: firstName || "",
          lastName: lastName || "",
          mfaEnabled: mfaEnabled || false,
          mustChangePassword: true,
          passwordExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
          createdByUserId: (session.user as any).id,
        })
        .returning()

      // Log action
      await tx.insert(auditLogs).values({
        userId: (session.user as any).id,
        organizationId: orgId,
        action: "CREATE_EMPLOYEE_CREDENTIAL",
        entity: "EMPLOYEE_CREDENTIAL",
        entityId: String(credential.id),
        metadata: {
          email,
          branchId: userBranchId,
        },
      })

      return credential
    })

    return NextResponse.json({ credential: result }, { status: 201 })
  } catch (err: any) {
    console.error("POST /employee-credentials error:", err)
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: err.message === "Email already in use" ? 400 : 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if ((session.user as any).role !== "BRANCH_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Branch Admin access required" }, { status: 403 })
    }

    const userBranchId = (session.user as any).branchId
    const orgId = (session.user as any).organizationId

    if (!userBranchId || !orgId) {
      return NextResponse.json({ error: "Branch admin must be assigned to a branch" }, { status: 403 })
    }

    const credentials = await withTenant(session.user as any, async (tx) => {
      return await tx
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
    })

    return NextResponse.json({ credentials })
  } catch (err: any) {
    console.error("GET /employee-credentials error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if ((session.user as any).role !== "BRANCH_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Branch Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { id, isActive, firstName, lastName, password, email } = body

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    const credId = Number(id)
    if (isNaN(credId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 })
    }

    const userBranchId = (session.user as any).branchId
    if (!userBranchId) {
      return NextResponse.json({ error: "Branch admin must be assigned to a branch" }, { status: 403 })
    }

    const result = await withTenant(session.user as any, async (tx) => {
      // Verify ownership
      const [cred] = await tx
        .select()
        .from(employeeCredentials)
        .where(
          and(
            eq(employeeCredentials.id, credId),
            eq(employeeCredentials.branchId, userBranchId)
          )
        )

      if (!cred) {
        throw new Error("Credential not found")
      }

      const updates: any = {}
      if (isActive !== undefined) updates.isActive = isActive
      if (firstName !== undefined) updates.firstName = firstName
      if (lastName !== undefined) updates.lastName = lastName

      // Handle email update
      if (email && email !== cred.email) {
        // Check if email already exists
        const [existing] = await tx
          .select()
          .from(employeeCredentials)
          .where(eq(employeeCredentials.email, email))
          .limit(1)
        if (existing) {
          throw new Error("Email already in use")
        }
        updates.email = email
      }

      // Handle password update
      if (password) {
        if (password.length < 12) {
          throw new Error("Password must be at least 12 characters")
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
          throw new Error("Password must include uppercase, lowercase, number, and special character")
        }
        updates.passwordHash = await hash(password, 10)
      }

      const securityChange = !!(password || (email && email !== cred.email))
      const nextVersion = (cred.sessionVersion || 0) + 1

      const [updated] = await tx
        .update(employeeCredentials)
        .set({ ...updates, sessionVersion: nextVersion, updatedAt: new Date() })
        .where(eq(employeeCredentials.id, credId))
        .returning()

      return { updated, securityChange }
    })

    return NextResponse.json({ credential: result.updated, sessionInvalidated: result.securityChange })
  } catch (err: any) {
    console.error("PUT /employee-credentials error:", err)
    const status = err.message === "Credential not found" ? 404 : 400
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: err.message.includes("Internal") ? 500 : status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if ((session.user as any).role !== "BRANCH_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Branch Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    const userBranchId = (session.user as any).branchId
    if (!userBranchId) {
      return NextResponse.json({ error: "Branch admin must be assigned to a branch" }, { status: 403 })
    }

    const credId = Number(id)

    await withTenant(session.user as any, async (tx) => {
      // Verify ownership
      const [cred] = await tx
        .select()
        .from(employeeCredentials)
        .where(
          and(
            eq(employeeCredentials.id, credId),
            eq(employeeCredentials.branchId, userBranchId)
          )
        )

      if (!cred) {
        throw new Error("Credential not found")
      }

      await tx
        .update(employeeCredentials)
        .set({ isActive: false, deactivatedAt: new Date(), updatedAt: new Date() })
        .where(eq(employeeCredentials.id, credId))
    })

    return NextResponse.json({ message: "Credential deactivated" })
  } catch (err: any) {
    console.error("DELETE /employee-credentials error:", err)
    const status = err.message === "Credential not found" ? 404 : 500
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status })
  }
}


