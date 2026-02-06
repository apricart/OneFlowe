import { type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { users, systemLogs, mfaCodes, orders, groups, auditLogs, notifications, employeeCredentials, sessions, groupAuditLogs } from "@/db/schema"
import { eq, or, count } from "drizzle-orm"
import { hashPassword } from "@/lib/password"
import { ok, error, requireApiRole, readJson } from "@/lib/api"
import { getRequestScope } from "@/lib/auth"
import { headers } from "next/headers"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
    if (err) return err
    const { id } = await params
    const body = await readJson<any>(req)
    if (!body) return error("Invalid body", 400)

    // Check if HEAD_OFFICE user can edit this user
    const scope = await getRequestScope()
    if (scope?.role === "HEAD_OFFICE") {
      const [targetUser] = await db.select({ organizationId: users.organizationId }).from(users).where(eq(users.id, id)).limit(1)
      if (!targetUser) {
        return error("User not found", 404)
      }
      if (targetUser.organizationId !== scope.organizationId) {
        return error("You can only edit users within your own organization", 403)
      }
    }

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
          updatedUserBranchId: body.branchId
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
    console.error("[API/Users] CRITICAL ERROR IN PATCH:", criticalErr)
    return error(criticalErr.message || "Failed to update user", 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const { id } = await params

  try {
    const scope = await getRequestScope()
    if (scope?.role === "HEAD_OFFICE") {
      const [targetUser] = await db.select({ organizationId: users.organizationId }).from(users).where(eq(users.id, id)).limit(1)
      if (!targetUser) {
        return error("User not found", 404)
      }
      if (targetUser.organizationId !== scope.organizationId) {
        return error("You can only delete users within your own organization", 403)
      }
    }

    // Dependency checks - Block deletion if critical data exists
    const {
      branches,
      orders,
      refunds,
      restockRequests,
      groups,
      globalProducts: globalProductsTable
    } = await import("@/db/schema")

    // Check for critical dependencies before attempting deletion
    const [
      adminCount,
      orderCount,
      refundCount,
      restockCount,
      groupCount,
      productCount,
      userCreds
    ] = await Promise.all([
      // 1. Check if user is an admin for any branches
      db.select({ val: count() }).from(branches).where(eq(branches.adminUserId, id)),

      // 2. Check for orders involvement (created, approved, rejected, fulfilled, or refunded)
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
      db.select({ count: count() }).from(employeeCredentials).where(eq(employeeCredentials.createdByUserId, id))
    ])

    // Return error messages for critical dependencies
    if (adminCount[0].val > 0) {
      return error(`Cannot delete: This user is assigned as the administrator for ${adminCount[0].val} branch(es). Please reassign branch administration before deleting.`, 400)
    }

    if (orderCount[0].val > 0) {
      return error(`Cannot delete: This user has historical transaction records (${orderCount[0].val} orders) as a creator or approver. To preserve audit integrity, please deactivate the account instead.`, 400)
    }

    if (refundCount[0].val > 0) {
      return error(`Cannot delete: This user has ${refundCount[0].val} historical refund records. Please deactivate the account instead.`, 400)
    }

    if (restockCount[0].val > 0) {
      return error(`Cannot delete: This user has ${restockCount[0].val} historical restock request records. Please deactivate the account instead.`, 400)
    }

    if (groupCount[0].val > 0) {
      return error(`Cannot delete: This user created ${groupCount[0].val} group(s). Please reassign group ownership or deactivate.`, 400)
    }

    if (productCount[0].val > 0) {
      return error(`Cannot delete: This user created ${productCount[0].val} master products in the global inventory. Please deactivate the account instead.`, 400)
    }

    if (userCreds[0].count > 0) {
      return error(`Cannot delete: This user created ${userCreds[0].count} employee credentials. Please deactivate instead.`, 400)
    }

    // Clean up non-critical dependencies before deletion
    // MFA codes, sessions, notifications can be safely deleted
    // Audit logs should preserve the user ID for historical integrity (set to null)
    console.log(`[API/Users] Cleaning up dependencies for user ${id}...`)

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

    // Then delete the user
    await db.delete(users).where(eq(users.id, id))

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

    // For any other database errors, return a generic message to avoid leaking internals
    return error("Failed to delete user. If this user has historical data or active sessions, please deactivate the account instead.", 500)
  }
}
