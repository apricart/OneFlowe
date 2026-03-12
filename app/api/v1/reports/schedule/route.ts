import { NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { requireApiRole, ok, error } from "@/lib/api"
import { db } from "@/lib/db"
import { scheduledReports } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const

export async function GET(req: NextRequest) {
    const err = await requireApiRole(allowedRoles as any)
    if (err) return err

    const scope = await getRequestScope()
    if (!scope?.userId) return error("Unauthorized", 401)

    const userSchedules = await db
        .select()
        .from(scheduledReports)
        .where(eq(scheduledReports.userId, scope.userId))

    return ok(userSchedules)
}

export async function POST(req: NextRequest) {
    const err = await requireApiRole(allowedRoles as any)
    if (err) return err

    const scope = await getRequestScope()
    if (!scope?.userId) return error("Unauthorized", 401)

    const body = await req.json()
    const { reportName, frequency, format, emails, enabled, id } = body

    if (!reportName || !frequency || !format || !emails) {
        return error("Missing required fields")
    }

    try {
        if (id) {
            // Update
            const [updated] = await db
                .update(scheduledReports)
                .set({
                    frequency,
                    format,
                    emails,
                    enabled,
                    updatedAt: new Date(),
                })
                .where(and(eq(scheduledReports.id, Number(id)), eq(scheduledReports.userId, scope.userId)))
                .returning()

            return ok(updated)
        } else {
            // Create
            const [created] = await db
                .insert(scheduledReports)
                .values({
                    organizationId: scope.organizationId,
                    userId: scope.userId,
                    reportName,
                    frequency,
                    format,
                    emails,
                    enabled: true,
                })
                .returning()

            return ok(created)
        }
    } catch (e: any) {
        console.error("Schedule Save Error:", e)
        return error(e.message || "Failed to save schedule")
    }
}

export async function DELETE(req: NextRequest) {
    const err = await requireApiRole(allowedRoles as any)
    if (err) return err

    const scope = await getRequestScope()
    if (!scope?.userId) return error("Unauthorized", 401)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return error("Missing ID")

    await db
        .delete(scheduledReports)
        .where(and(eq(scheduledReports.id, Number(id)), eq(scheduledReports.userId, scope.userId)))

    return ok({ success: true })
}
