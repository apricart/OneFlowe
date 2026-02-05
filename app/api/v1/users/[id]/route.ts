import { type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { users, systemLogs } from "@/db/schema"
import { eq } from "drizzle-orm"
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
    const { count, or } = await import("drizzle-orm")

    // 1. Check if user is an admin for any branches
    const [adminCount] = await db.select({ val: count() }).from(branches).where(eq(branches.adminUserId, id))
    if (adminCount.val > 0) {
      return error(`Cannot delete: This user is assigned as the administrator for ${adminCount.val} branch(es). Please reassign branch administration before deleting.`, 400)
    }

    // 2. Check for orders involvement (created, approved, rejected, fulfilled, or refunded)
    const [orderCount] = await db.select({ val: count() }).from(orders).where(
      or(
        eq(orders.createdByUserId, id),
        eq(orders.approvedByUserId, id),
        eq(orders.rejectedByUserId, id),
        eq(orders.fulfilledByUserId, id),
        eq(orders.refundedByUserId, id)
      )
    )
    if (orderCount.val > 0) {
      return error(`Cannot delete: This user has historical transaction records (Orders) as a creator or approver. To preserve audit integrity, this user cannot be deleted. Please deactivate the account instead.`, 400)
    }

    // 3. Check for refunds involvement
    const [refundCount] = await db.select({ val: count() }).from(refunds).where(
      or(
        eq(refunds.requestedByUserId, id),
        eq(refunds.processedByUserId, id)
      )
    )
    if (refundCount.val > 0) {
      return error(`Cannot delete: This user has historical refund records as a requester or processor. Please deactivate the account instead.`, 400)
    }

    // 4. Check for restock requests
    const [restockCount] = await db.select({ val: count() }).from(restockRequests).where(
      or(
        eq(restockRequests.requestedByUserId, id),
        eq(restockRequests.reviewedByUserId, id)
      )
    )
    if (restockCount.val > 0) {
      return error(`Cannot delete: This user has historical restock request records. Please deactivate the account instead.`, 400)
    }

    // 5. Check for groups created
    const [groupCount] = await db.select({ val: count() }).from(groups).where(eq(groups.createdByUserId, id))
    if (groupCount.val > 0) {
      return error(`Cannot delete: This user created ${groupCount.val} group(s). Please reassign group ownership or deactivate.`, 400)
    }

    // 6. Check for master products created
    const [productCount] = await db.select({ val: count() }).from(globalProductsTable).where(eq(globalProductsTable.createdByUserId, id))
    if (productCount.val > 0) {
      return error(`Cannot delete: This user created ${productCount.val} master products in the global inventory. Please deactivate the account instead.`, 400)
    }

    // Execute deletion
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
      return error("Cannot delete: This user is linked to other historical records (audit logs, settings, or assignments). To preserve system history and stability, please Deactivate the user instead.", 400)
    }

    return error(err.message || "Failed to delete user", 500)
  }
}
