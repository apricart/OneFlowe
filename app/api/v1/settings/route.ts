import { db } from "@/lib/db"
import { organizationSettings, auditLogs } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { ok, err, requireApiRole } from "@/lib/api"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const authErr = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (authErr) return authErr

  const { searchParams } = req.nextUrl
  const organizationId = searchParams.get("organizationId")

  if (organizationId) {
    const settings = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, parseInt(organizationId)))
    
    return ok({ data: settings })
  }

  const allSettings = await db.select().from(organizationSettings)
  return ok({ data: allSettings })
}

export async function POST(req: NextRequest) {
  const authErr = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (authErr) return authErr

  try {
    const body = await req.json()
    const { organizationId, key, value } = body

    if (!organizationId || !key) {
      return err("organizationId and key are required", 400)
    }

    // Check if setting already exists
    const existing = await db
      .select()
      .from(organizationSettings)
      .where(
        and(
          eq(organizationSettings.organizationId, organizationId),
          eq(organizationSettings.key, key)
        )
      )
      .limit(1)

    let result
    if (existing.length > 0) {
      // Update existing setting
      [result] = await db
        .update(organizationSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(organizationSettings.id, existing[0].id))
        .returning()
    } else {
      // Create new setting
      [result] = await db
        .insert(organizationSettings)
        .values({ organizationId, key, value })
        .returning()
    }

    // Log the action
    await db.insert(auditLogs).values({
      action: existing.length > 0 ? "UPDATE_SETTING" : "CREATE_SETTING",
      entity: "organization_settings",
      entityId: result.id.toString(),
      organizationId,
      metadata: { key, value },
    })

    return ok({ data: result })
  } catch (error: any) {
    return err(error.message || "Failed to save setting", 500)
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = await requireApiRole(["SUPER_ADMIN"])
  if (authErr) return authErr

  try {
    const { searchParams } = req.nextUrl
    const id = searchParams.get("id")

    if (!id) {
      return err("Setting id is required", 400)
    }

    const [deleted] = await db
      .delete(organizationSettings)
      .where(eq(organizationSettings.id, parseInt(id)))
      .returning()

    // Log the action
    await db.insert(auditLogs).values({
      action: "DELETE_SETTING",
      entity: "organization_settings",
      entityId: id,
      organizationId: deleted.organizationId,
    })

    return ok({ message: "Setting deleted successfully" })
  } catch (error: any) {
    return err(error.message || "Failed to delete setting", 500)
  }
}

