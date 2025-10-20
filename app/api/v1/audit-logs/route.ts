import { db } from "@/lib/db"
import { auditLogs, users } from "@/db/schema"
import { desc, eq, and, sql } from "drizzle-orm"
import { ok, err, requireApiRole } from "@/lib/api"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const authErr = await requireApiRole(["SUPER_ADMIN"])
  if (authErr) return authErr

  const { searchParams } = req.nextUrl
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")
  const entity = searchParams.get("entity")
  const action = searchParams.get("action")

  try {
    let query = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        organizationId: auditLogs.organizationId,
        branchId: auditLogs.branchId,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        userEmail: users.email,
        userFullName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset)

    // Apply filters if provided
    const conditions = []
    if (entity) {
      conditions.push(eq(auditLogs.entity, entity))
    }
    if (action) {
      conditions.push(eq(auditLogs.action, action))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    const logs = await query

    return ok({ data: logs, meta: { limit, offset } })
  } catch (error: any) {
    return err(error.message || "Failed to fetch audit logs", 500)
  }
}

