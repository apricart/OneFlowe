import { type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword } from "@/lib/password"
import { ok, error, requireApiRole, readJson } from "@/lib/api"
import { getRequestScope } from "@/lib/auth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const { id } = await params
  const body = await readJson<any>(req)
  if (!body) return error("Invalid body", 400)
  
  // Check if HEAD_OFFICE user can edit this user
  try {
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
  } catch (scopeError) {
    console.error("Error getting request scope:", scopeError)
    return error("Unable to verify permissions", 500)
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
    patch.organizationId = body.organizationId ? parseInt(body.organizationId) : null
  }
  if (body.branchId !== undefined) {
    patch.branchId = body.branchId ? parseInt(body.branchId) : null
  }
  
  // Update password if provided
  if (body.password) patch.passwordHash = await hashPassword(body.password)
  
  await db.update(users).set(patch).where(eq(users.id, id))
  return ok({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (err) return err
  const { id } = await params
  
  // Check if HEAD_OFFICE user can delete this user
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
  } catch (scopeError) {
    console.error("Error getting request scope:", scopeError)
    return error("Unable to verify permissions", 500)
  }
  
  await db.delete(users).where(eq(users.id, id))
  return ok({ success: true })
}
