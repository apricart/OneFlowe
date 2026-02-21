import { type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { users, systemLogs, mfaCodes, orders, groups, auditLogs, notifications, employeeCredentials, sessions, groupAuditLogs } from "@/db/schema"
import { eq, or, count } from "drizzle-orm"
import { hashPassword } from "@/lib/password"
import { ok, error, requireApiRole, readJson } from "@/lib/api"
import { getRequestScope } from "@/lib/auth"
import { headers } from "next/headers"

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
    if (err) return err
    const params = await props.params
    const { id } = params
    const body = await readJson<any>(req)
    if (!body) return error("Invalid body", 400)

    // Check if HEAD_OFFICE user can edit this user (BOLA Protection)
    const { verifyResourceAccess } = await import("@/lib/auth")
    const [targetUser] = await db.select({
      organizationId: users.organizationId,
      email: users.email
    }).from(users).where(eq(users.id, id)).limit(1)
    if (!targetUser) return error("User not found", 404)

    const hasAccess = await verifyResourceAccess(targetUser.organizationId)
    if (!hasAccess) return error("Forbidden: You do not have access to this user", 403)

    const patch: any = { updatedAt: new Date() }

    // Update basic fields
    if (body.email) patch.email = body.email
    if (body.firstName !== undefined) patch.firstName = body.firstName
    if (body.lastName !== undefined) patch.lastName = body.lastName
    if (body.phone !== undefined) patch.phone = body.phone
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive
    if (typeof body.mfaEnabled === "boolean") patch.mfaEnabled = body.mfaEnabled

    // Update full name if first or last name changed
    if (body.firstName || body.lastName) {
      const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      const firstName = body.firstName || existing?.firstName || ""
      const lastName = body.lastName || existing?.lastName || ""
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

    // Execute update
    await db.update(users).set(patch).where(eq(users.id, id))

    // If password or email changed, invalidate all sessions by incrementing version
    if (body.password || body.email) {
      console.log(`[API/Users] Password or email updated for user ${id}. Incrementing session version...`)
      const [currentUser] = await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, id)).limit(1)
      const nextVersion = (currentUser?.sessionVersion || 0) + 1

      await db.update(users)
        .set({ sessionVersion: nextVersion })
        .where(eq(users.id, id))

      // Also delete physical sessions if they exist (for database-bound sessions if used)
      await db.delete(sessions).where(eq(sessions.userId, id))
    }

    // Audit Log (optional)
    try {
      const logScope = await getRequestScope()
      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const forwardedFor = headersList.get("x-forwarded-for")
      const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown"

      await db.insert(systemLogs).values({
        userId: logScope?.userId,
        userRole: logScope?.role,
        organizationId: logScope?.organizationId,
        branchId: logScope?.branchId || undefined,
        action: "USER_UPDATE",
        resourceType: "user",
        resourceId: id,
        details: {
          patchKeys: Object.keys(patch),
          updatedUserOrgId: body.organizationId,
          updatedUserBranchId: body.branchId,
          sessionsInvalidated: !!(body.password || body.email)
        },
        ipAddress: ip,
        userAgent: userAgent,
        success: true
      })
    } catch (logErr) {
      console.error("[API/Users] Audit Log Error:", logErr)
    }

    return ok({ success: true })
  } catch (criticalErr: any) {
    console.error("[API/Users] ERROR IN PATCH:", criticalErr)
    const errorMessage = criticalErr.message || "Failed to update user"

    // Use 400 for validation errors so they aren't sanitized by the bank-grade error handler
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

    return error(errorMessage, isValidationError ? 400 : 500)
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const params = await props.params
  const { id } = params

  try {
    const scope = await getRequestScope()
    if (scope?.userId === id) {
      return error("Cannot delete: You cannot delete your own account while logged in.", 400)
    }

    const { verifyResourceAccess } = await import("@/lib/auth")
    const [targetUser] = await db.select({
      organizationId: users.organizationId,
      email: users.email
    }).from(users).where(eq(users.id, id)).limit(1)
    if (!targetUser) return error("User not found", 404)

    const hasAccess = await verifyResourceAccess(targetUser.organizationId)
    if (!hasAccess) return error("Forbidden: You do not have access to this user", 403)

    // Dependency checks - Block deletion if critical data exists
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
    ] = await Promise.all([
      // 1. Check if user is an admin for any branches
      db.select({ val: count() }).from(branches).where(eq(branches.adminUserId, id)),

      // 2. Check for orders involvement
      db.select({ val: count() }).from(orders).where(
        or(
          eq(orders.createdByUserId, id),
          eq(orders.approvedByUserId, id),
          eq(orders.rejectedByUserId, id),
          eq(orders.fulfilledByUserId, id),
          eq(orders.refundedByUserId, id)
        )
      ),

      // 3. Check for refunds involvement
      db.select({ val: count() }).from(refunds).where(
        or(
          eq(refunds.requestedByUserId, id),
          eq(refunds.processedByUserId, id)
        )
      ),

      // 4. Check for restock requests
      db.select({ val: count() }).from(restockRequests).where(
        or(
          eq(restockRequests.requestedByUserId, id),
          eq(restockRequests.reviewedByUserId, id)
        )
      ),

      // 5. Check for groups created
      db.select({ val: count() }).from(groups).where(eq(groups.createdByUserId, id)),

      // 6. Check for master products created
      db.select({ val: count() }).from(globalProductsTable).where(eq(globalProductsTable.createdByUserId, id)),

      // 7. Check for employee credentials created
      db.select({ count: count() }).from(employeeCredentials).where(eq(employeeCredentials.createdByUserId, id)),

      // 8. Check for inventory assignments
      db.select({ val: count() }).from(orgInventory).where(eq(orgInventory.assignedByUserId, id)),
      db.select({ val: count() }).from(branchInv).where(eq(branchInv.assignedByUserId, id)),
      db.select({ val: count() }).from(prodAssign).where(eq(prodAssign.performedByUserId, id)),

      // 9. Check for modifiers created
      db.select({ val: count() }).from(modsTable).where(eq(modsTable.createdByUserId, id))
    ])

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
      return error(`Cannot delete: This user is assigned as the administrator for ${adminCount[0].val} branch(es). Please reassign branch administration before deleting.`, 400)
    }

    if (hasHistory) {
      console.log(`[API/Users] User ${id} has historical records. Performing soft-delete...`)

      // Perform soft-delete
      await db.update(users).set({
        deletedAt: new Date(),
        isActive: false,
        // Append timestamp to email to free up the original email for a new account
        email: `deleted_${Date.now()}_${targetUser.email}`
      }).where(eq(users.id, id))

      // Clean up non-critical data
      console.log(`[API/Users] Cleaning up non-critical sessions/MFA for soft-deleted user ${id}...`)
      await Promise.all([
        db.delete(mfaCodes).where(eq(mfaCodes.userId, id)),
        db.delete(sessions).where(eq(sessions.userId, id)),
        db.delete(notifications).where(eq(notifications.userId, id))
      ])
    } else {
      // Clean up all dependencies before hard deletion
      console.log(`[API/Users] Cleaning up all dependencies for hard-delete of user ${id}...`)

      try {
        await Promise.all([
          db.delete(mfaCodes).where(eq(mfaCodes.userId, id)),
          db.delete(sessions).where(eq(sessions.userId, id)),
          db.delete(notifications).where(eq(notifications.userId, id)),
          db.delete(groupAuditLogs).where(eq(groupAuditLogs.performedByUserId, id)),
          db.update(auditLogs).set({ userId: null }).where(eq(auditLogs.userId, id)),
          db.update(systemLogs).set({ userId: null }).where(eq(systemLogs.userId, id))
        ])
        console.log(`[API/Users] Successfully cleaned up dependencies for user ${id}`)
      } catch (cleanupErr: any) {
        console.error("[API/Users] Error during dependency cleanup:", cleanupErr)
        return error(`Failed to clean up user dependencies: ${cleanupErr.message}. Please contact support.`, 500)
      }

      // Then delete the user from the database
      await db.delete(users).where(eq(users.id, id))
    }

    // Audit Log
    try {
      const logScope = await getRequestScope()
      const headersList = await headers()
      const userAgent = headersList.get("user-agent")
      const forwardedFor = headersList.get("x-forwarded-for")
      const ip = forwardedFor ? forwardedFor.split(',')[0] : "unknown"

      await db.insert(systemLogs).values({
        userId: logScope?.userId,
        userRole: logScope?.role,
        organizationId: logScope?.organizationId,
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
    } catch (logErr) {
      console.error("Failed to write audit log:", logErr)
    }

    return ok({ success: true })
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
        return error("Cannot delete: This user has active MFA codes. Please deactivate MFA first or contact support.", 400)
      }
      if (detail.includes("sessions")) {
        return error("Cannot delete: This user has active sessions. Please wait for sessions to expire or deactivate the user instead.", 400)
      }
      if (detail.includes("notifications")) {
        return error("Cannot delete: This user has notification history. To preserve system integrity, please deactivate the user instead.", 400)
      }
      if (detail.includes("audit_logs") || detail.includes("auditlogs")) {
        return error("Cannot delete: This user has audit log entries. To preserve system history, please deactivate the user instead.", 400)
      }

      // Generic FK error for any other tables
      return error("Cannot delete: This user is linked to other system records (sessions, notifications, or audit logs). To preserve system history and data integrity, please deactivate the user instead of deleting.", 400)
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

    return error(errorMessage, isValidationError ? 400 : 500)
  }
}
