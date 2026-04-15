export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { scheduledReports } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"
import { ok, error, forbidden, unauthorized } from "@/lib/api"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"]

export async function GET() {
  try {
    const scope = await getRequestScope()
    if (!scope) return unauthorized()
    if (!allowedRoles.includes(scope.role)) return forbidden()

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      return await tx.select().from(scheduledReports).where(eq(scheduledReports.userId, scope!.userId))
    }
    return ok(result)
  } catch (e: any) {
    return error(e.message || "Failed to fetch schedules")
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return unauthorized()
    if (!allowedRoles.includes(scope.role)) return forbidden()

    const body = await req.json()
    const { reportName, frequency, format, emails, enabled, id } = body
    if (!reportName || !frequency || !format || !emails) return error("Missing required fields", 400)

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      if (id) {
        const [updated] = await tx
          .update(scheduledReports)
          .set({ frequency, format, emails, enabled, updatedAt: new Date() })
          .where(and(eq(scheduledReports.id, Number(id)), eq(scheduledReports.userId, scope!.userId)))
          .returning()
        if (!updated) throw new Error("Schedule not found or not owned by user")
        return updated
      } else {
        const [created] = await tx
          .insert(scheduledReports)
          .values({ organizationId: scope!.organizationId, userId: scope!.userId, reportName, frequency, format, emails, enabled: true })
          .returning()
        return created
      }
    }
    return ok(result)
  } catch (e: any) {
    return error(e.message || "Failed to save schedule", e.message.includes("not found") ? 404 : 400)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return unauthorized()
    if (!allowedRoles.includes(scope.role)) return forbidden()

    const id = new URL(req.url).searchParams.get("id")
    if (!id) return error("Missing ID", 400)

    await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const [deleted] = await tx
        .delete(scheduledReports)
        .where(and(eq(scheduledReports.id, Number(id)), eq(scheduledReports.userId, scope!.userId)))
        .returning()
      if (!deleted) throw new Error("Schedule not found or not owned by user")
    }
    return ok({ success: true })
  } catch (e: any) {
    return error(e.message || "Failed to delete schedule", 404)
  }
}
