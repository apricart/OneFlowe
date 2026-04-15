import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { users, systemLogs, mfaCodes, orders, groups, auditLogs, notifications, employeeCredentials, sessions, groupAuditLogs, roles as rolesTable } from "@/db/schema"
import { eq, or, count, and, ne } from "drizzle-orm"
import { hashPassword } from "@/lib/password"
import { invalidateByPrefix } from "@/lib/cache-utils"
import { headers } from "next/headers"

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUserRole = (session.user as any).role
    if (currentUserRole !== "SUPER_ADMIN" && currentUserRole !== "HEAD_OFFICE") {
      return NextResponse.json({ error: "Forbidden: Head Office or Super Admin required" }, { status: 403 })
    }

    const params = await props.params
    const { id } = params

    // Validate ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      console.error(`[API/Users] Invalid target ID format: ${id}`)
      return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 })
    }

    const body = await req.json()
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

    const [targetUser] = await withTenant(session.user as any, async (tx) => 
      tx.select({
        organizationId: users.organizationId,
        branchId: users.branchId,
        email: users.email
      }).from(users).where(eq(users.id, id)).limit(1)
    ) as any[]

    if (!targetUser) {
      return NextResponse.json({ error: "User not found or access denied" }, { status: 404 })
    }

    // Check uniqueness if email or username changed
    if (body.username) {
      const [existing] = await withSuperAdmin(async (tx) => 
        tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, body.username))
          .limit(1)
      ) as any[]
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Username already in use by another user" }, { status: 400 })
      }
    }

    const patch: any = { updatedAt: new Date() }

    // Determine if email actually changed (avoid unnecessary session invalidation)
    const emailActuallyChanged = body.email && body.email !== targetUser.email

    // Update basic fields
    if (emailActuallyChanged) patch.email = body.email
    if (body.firstName !== undefined) patch.firstName = body.firstName
    if (body.lastName !== undefined) patch.lastName = body.lastName
    if (body.phone !== undefined) patch.phone = body.phone
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive
    if (typeof body.mfaEnabled === "boolean") patch.mfaEnabled = body.mfaEnabled
    if (body.employeeId !== undefined) patch.employeeId = body.employeeId || null
    if (body.imprestHolder !== undefined) patch.imprestHolder = body.imprestHolder || null
    if (body.contactPerson !== undefined) patch.contactPerson = body.contactPerson || null
    if (body.address !== undefined) patch.address = body.address || null

    // Update full name if first or last name changed
    if (body.firstName || body.lastName) {
      const firstName = body.firstName !== undefined ? body.firstName : (targetUser as any).firstName || ""
      const lastName = body.lastName !== undefined ? body.lastName : (targetUser as any).lastName || ""
      patch.fullName = `${firstName} ${lastName}`.trim()
    }

    // Update organization and branch
    if (body.organizationId !== undefined) {
      const orgId = (body.organizationId === null || body.organizationId === "") ? null : parseInt(body.organizationId)
      patch.organizationId = isNaN(orgId as any) ? null : orgId
    }
    if (body.branchId !== undefined) {
      const bId = (body.branchId === null || body.branchId === "") ? null : parseInt(body.branchId)
      patch.branchId = isNaN(bId as any) ? null : bId
    }

    // Update password if provided
    if (body.password) {
      patch.passwordHash = await hashPassword(body.password)
    }

    // If password, email, organization, or branch actually changed, bump sessionVersion atomically in the same update
    const orgChanged = body.organizationId !== undefined && body.organizationId !== String(targetUser.organizationId)
    const branchChanged = body.branchId !== undefined && body.branchId !== String(targetUser.branchId)
    const isSecurityChange = !!body.password || emailActuallyChanged || orgChanged || branchChanged
    if (isSecurityChange) {
      console.log(`[API/Users] Security-relevant change for user ${id}. Incrementing session version...`)
      const [u] = await withTenant(session.user as any, async (tx) => 
        tx.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, id)).limit(1)
      ) as any[]
      patch.sessionVersion = (u?.sessionVersion || 0) + 1
    }

    // Execute update (includes sessionVersion bump if needed — single atomic write)
    console.log(`[API/Users] Executing update for user ${id}. Fields: ${Object.keys(patch).join(', ')}`)
    
    const updatedRows = await withTenant(session.user as any, async (tx) => 
      tx.update(users).set(patch).where(eq(users.id, id)).returning({ id: users.id })
    )

    console.log(`[API/Users] Update complete. Rows affected: ${updatedRows.length}`)

    if (updatedRows.length > 1) {
      console.error(`[API/Users] CRITICAL SAFETY TRIGGER: Bulk update detected (${updatedRows.length} rows)! Rolling back...`)
      throw new Error("Bulk update safety triggered")
    }

    if (updatedRows.length === 0) {
      console.warn(`[API/Users] No rows updated for user ${id}`)
      return NextResponse.json({ error: "Update failed: User record not found" }, { status: 404 })
    }

    // Also delete physical sessions if they exist (for database-bound sessions if used)
    if (isSecurityChange) {
      await withTenant(session.user as any, async (tx) => 
        tx.delete(sessions).where(eq(sessions.userId, id))
      )
    }

    // Audit Log (optional)
    try {
      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const forwardedFor = headersList.get("x-forwarded-for")
      const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown"

      await withTenant(session.user as any, async (tx) => 
        tx.insert(systemLogs).values({
          userId: (session.user as any).id,
          userRole: currentUserRole,
          organizationId: (session.user as any).organizationId,
          branchId: (session.user as any).branchId || undefined,
          action: "USER_UPDATE",
          resourceType: "user",
          resourceId: id,
          details: {
            patchKeys: Object.keys(patch),
            updatedUserOrgId: body.organizationId,
            updatedUserBranchId: body.branchId,
            sessionsInvalidated: isSecurityChange
          },
          ipAddress: ip,
          userAgent: userAgent,
          success: true
        })
      )
    } catch (logErr) {
      console.error("[API/Users] Audit Log Error:", logErr)
    }

    // Invalidate users cache so lists refresh immediately in production
    await invalidateByPrefix('users')

    return NextResponse.json({ success: true })
  } catch (criticalErr: any) {
    const errorMessage = criticalErr.message || "Failed to update user"
    console.error("[API/Users] ERROR IN PATCH:", criticalErr)

    if (criticalErr.code === '23505' || errorMessage.includes('unique constraint') || errorMessage.includes('already exists')) {
      const detail = String(criticalErr.detail || criticalErr.cause?.detail || "").toLowerCase()
      if (detail.includes('username')) return NextResponse.json({ error: "Username already in use by another user" }, { status: 400 })
      if (detail.includes('employee_id')) return NextResponse.json({ error: "Internal ID (Employee ID) already exists." }, { status: 400 })
      if (detail.includes('email')) return NextResponse.json({ error: "Email address already exists." }, { status: 400 })
      if (detail.includes('phone')) return NextResponse.json({ error: "Phone number already exists." }, { status: 400 })
      return NextResponse.json({ error: "Unique field conflict: " + detail }, { status: 400 })
    }

    const isValidationError = errorMessage.includes("Invalid password") ||
      errorMessage.includes("already exists") ||
      errorMessage.includes("Password") ||
      errorMessage.includes("unique constraint") ||
      errorMessage.includes("violates") ||
      errorMessage.includes("foreign key") ||
      errorMessage.includes("linked") ||
      errorMessage.includes("Cannot") ||
      criticalErr.code === "23505" ||
      criticalErr.code === "23503"

    return NextResponse.json({ error: errorMessage }, { status: isValidationError ? 400 : 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUserRole = (session.user as any).role
    if (currentUserRole !== "SUPER_ADMIN" && currentUserRole !== "HEAD_OFFICE") {
      return NextResponse.json({ error: "Forbidden: Head Office or Super Admin required" }, { status: 403 })
    }

    const params = await props.params
    const { id } = params

    if ((session.user as any).id === id) {
      return NextResponse.json({ error: "Cannot delete: You cannot delete your own account while logged in." }, { status: 400 })
    }

    const [targetUser] = await withTenant(session.user as any, async (tx) => 
      tx.select({
        organizationId: users.organizationId,
        email: users.email
      }).from(users).where(eq(users.id, id)).limit(1)
    ) as any[]

    if (!targetUser) {
      return NextResponse.json({ error: "User not found or access denied" }, { status: 404 })
    }

    // Check for critical dependencies before attempting deletion
    const [
      adminCount,
      orderCount,
      refundCount,
      restockCount,
      groupCount,
      productCount,
      userCreds,
      orgInvCount,
      branchInvCount,
      prodAssignCount,
      modCount
    ] = await withTenant(session.user as any, async (tx) => {
      const {
        branches,
        orders,
        refunds,
        restockRequests,
        groups,
        globalProducts: globalProductsTable,
        organizationInventory: orgInventory,
        branchInventory: branchInv,
        productAssignments: prodAssign,
        modifiers: modsTable
      } = await import("@/db/schema")
      
      return await Promise.all([
        // 1. Check if user is an admin for any branches
        tx.select({ val: count() }).from(branches).where(eq(branches.adminUserId, id)),

        // 2. Check for orders involvement
        tx.select({ val: count() }).from(orders).where(
          or(
            eq(orders.createdByUserId, id),
            eq(orders.approvedByUserId, id),
            eq(orders.rejectedByUserId, id),
            eq(orders.fulfilledByUserId, id),
            eq(orders.refundedByUserId, id)
          )
        ),

        // 3. Check for refunds involvement
        tx.select({ val: count() }).from(refunds).where(
          or(
            eq(refunds.requestedByUserId, id),
            eq(refunds.processedByUserId, id)
          )
        ),

        // 4. Check for restock requests
        tx.select({ val: count() }).from(restockRequests).where(
          or(
            eq(restockRequests.requestedByUserId, id),
            eq(restockRequests.reviewedByUserId, id)
          )
        ),

        // 5. Check for groups created
        tx.select({ val: count() }).from(groups).where(eq(groups.createdByUserId, id)),

        // 6. Check for master products created
        tx.select({ val: count() }).from(globalProductsTable).where(eq(globalProductsTable.createdByUserId, id)),

        // 7. Check for employee credentials created
        tx.select({ count: count() }).from(employeeCredentials).where(eq(employeeCredentials.createdByUserId, id)),

        // 8. Check for inventory assignments
        tx.select({ val: count() }).from(orgInventory).where(eq(orgInventory.assignedByUserId, id)),
        tx.select({ val: count() }).from(branchInv).where(eq(branchInv.assignedByUserId, id)),
        tx.select({ val: count() }).from(prodAssign).where(eq(prodAssign.performedByUserId, id)),

        // 9. Check for modifiers created
        tx.select({ val: count() }).from(modsTable).where(eq(modsTable.createdByUserId, id))
      ])
    }) as any[]

    // Decide between hard delete and soft delete
    const hasHistory = orderCount[0].val > 0 ||
      refundCount[0].val > 0 ||
      restockCount[0].val > 0 ||
      productCount[0].val > 0 ||
      userCreds[0].count > 0 ||
      groupCount[0].val > 0 ||
      orgInvCount[0].val > 0 ||
      branchInvCount[0].val > 0 ||
      prodAssignCount[0].val > 0 ||
      modCount[0].val > 0

    // Return error messages ONLY for critical active roles that MUST be reassigned
    if (adminCount[0].val > 0) {
      return NextResponse.json({ error: `Cannot delete: This user is assigned as the administrator for ${adminCount[0].val} branch(es). Please reassign branch administration before deleting.` }, { status: 400 })
    }

    if (hasHistory) {
      console.log(`[API/Users] User ${id} has historical records. Performing soft-delete...`)

      // Perform soft-delete
      await withTenant(session.user as any, async (tx) => 
        tx.update(users).set({
          deletedAt: new Date(),
          isActive: false,
          // Append timestamp to email to free up the original email for a new account
          email: `deleted_${Date.now()}_${targetUser.email}`
        }).where(eq(users.id, id))
      )

      // Clean up non-critical data
      console.log(`[API/Users] Cleaning up non-critical sessions/MFA for soft-deleted user ${id}...`)
      await withTenant(session.user as any, async (tx) => {
        await Promise.all([
          tx.delete(mfaCodes).where(eq(mfaCodes.userId, id)),
          tx.delete(sessions).where(eq(sessions.userId, id)),
          tx.delete(notifications).where(eq(notifications.userId, id))
        ])
      })
    } else {
      // Clean up all dependencies before hard deletion
      console.log(`[API/Users] Cleaning up all dependencies for hard-delete of user ${id}...`)

      try {
        await withTenant(session.user as any, async (tx) => {
          await Promise.all([
            tx.delete(mfaCodes).where(eq(mfaCodes.userId, id)),
            tx.delete(sessions).where(eq(sessions.userId, id)),
            tx.delete(notifications).where(eq(notifications.userId, id)),
            tx.delete(groupAuditLogs).where(eq(groupAuditLogs.performedByUserId, id)),
            tx.update(auditLogs).set({ userId: null }).where(eq(auditLogs.userId, id)),
            tx.update(systemLogs).set({ userId: null }).where(eq(systemLogs.userId, id))
          ])
        })
        console.log(`[API/Users] Successfully cleaned up dependencies for user ${id}`)
      } catch (cleanupErr: any) {
        console.error("[API/Users] Error during dependency cleanup:", cleanupErr)
        return NextResponse.json({ error: `Failed to clean up user dependencies: ${cleanupErr.message}. Please contact support.` }, { status: 500 })
      }

      // Then delete the user from the database
      await withTenant(session.user as any, async (tx) => 
        tx.delete(users).where(eq(users.id, id))
      )
    }

    // Invalidate users cache
    await invalidateByPrefix('users')

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
          organizationId: (session.user as any).organizationId,
          branchId: undefined,
          action: "USER_DELETE",
          resourceType: "user",
          resourceId: id,
          details: {
            deletedUserId: id
          },
          ipAddress: ip,
          userAgent: userAgent,
          success: true
        })
      )
    } catch (logErr) {
      console.error("Failed to write audit log:", logErr)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[API/Users] CRITICAL ERROR IN DELETE:", {
      message: err.message,
      code: err.code,
      constraint: err.constraint,
      detail: err.detail,
      stack: err.stack
    })

    // Handle foreign key constraints commonly encountered when deleting users
    const errorMessage = err.message?.toLowerCase() || ""
    const errorCode = err.code || ""

    if (errorCode === "23503" || errorMessage.includes("foreign key") || errorMessage.includes("violates")) {
      // Check which table is causing the FK violation from error details
      const detail = err.detail?.toLowerCase() || ""

      if (detail.includes("mfa_codes") || detail.includes("mfacodes")) {
        return NextResponse.json({ error: "Cannot delete: This user has active MFA codes. Please deactivate MFA first or contact support." }, { status: 400 })
      }
      if (detail.includes("sessions")) {
        return NextResponse.json({ error: "Cannot delete: This user has active sessions. Please wait for sessions to expire or deactivate the user instead." }, { status: 400 })
      }
      if (detail.includes("notifications")) {
        return NextResponse.json({ error: "Cannot delete: This user has notification history. To preserve system integrity, please deactivate the user instead." }, { status: 400 })
      }
      if (detail.includes("audit_logs") || detail.includes("auditlogs")) {
        return NextResponse.json({ error: "Cannot delete: This user has audit log entries. To preserve system history, please deactivate the user instead." }, { status: 400 })
      }

      // Generic FK error for any other tables
      return NextResponse.json({ error: "Cannot delete: This user is linked to other system records (sessions, notifications, or audit logs). To preserve system history and data integrity, please deactivate the user instead of deleting." }, { status: 400 })
    }

    const isValidationError = errorMessage.includes("foreign key") ||
      errorMessage.includes("violates") ||
      errorMessage.includes("unique constraint") ||
      errorMessage.includes("Cannot delete") ||
      errorMessage.includes("history") ||
      errorMessage.includes("linked") ||
      errorMessage.includes("Please reassign") ||
      err.code === "23503" ||
      err.code === "23505"

    return NextResponse.json({ error: errorMessage }, { status: isValidationError ? 400 : 500 })
  }
}
