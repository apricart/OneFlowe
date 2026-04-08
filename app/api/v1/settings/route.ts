import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { organizationSettings, auditLogs } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { getCached, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"

// Valid setting keys
const VALID_SETTING_KEYS = new Set([
  'default_currency',
  'tax_rate',
  'auto_approve_orders',
  'order_approval_threshold',
  'require_mfa',
  'session_timeout_minutes',
  'low_stock_threshold',
  'enable_notifications'
])

/**
 * GET /api/v1/settings - Fetch organization settings
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN" && user.role !== "HEAD_OFFICE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    let organizationIdParam = searchParams.get("organizationId")

    if (user.role === "HEAD_OFFICE") {
      organizationIdParam = String(user.organizationId)
    }

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    if (organizationIdParam) {
      const organizationId = parseInt(organizationIdParam, 10)
      if (isNaN(organizationId)) return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })

      const cacheKey = scopedCacheKey('settings', { orgId: organizationId })

      const settings = await getCached(cacheKey, async () => {
        return await runner(async (tx: any) => {
          return await tx
            .select()
            .from(organizationSettings)
            .where(eq(organizationSettings.organizationId, organizationId))
        })
      }, CACHE_TTL.SETTINGS)

      return NextResponse.json({ data: (settings as any) })
    }

    // SUPER_ADMIN only: Return all settings
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const cacheKeyAll = 'cache:settings:all'
    const allSettings = await getCached(cacheKeyAll, async () => {
      return await withSuperAdmin(async (tx) => {
        return await tx.select().from(organizationSettings)
      })
    }, CACHE_TTL.SETTINGS)

    return NextResponse.json({ data: (allSettings as any) })
  } catch (e: any) {
    console.error("Settings GET Error:", e)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

/**
 * POST /api/v1/settings - Create or update setting
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN" && user.role !== "HEAD_OFFICE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { organizationId, key, value } = body

    if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 })
    if (user.role === "HEAD_OFFICE" && Number(organizationId) !== user.organizationId) {

      return NextResponse.json({ error: "Forbidden: Cannot modify settings for other organizations" }, { status: 403 })
    }

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: "key is required and must be a string" }, { status: 400 })
    }

    if (typeof organizationId !== 'number' || organizationId <= 0) {
      return NextResponse.json({ error: "organizationId must be a positive number" }, { status: 400 })
    }

    if (!VALID_SETTING_KEYS.has(key)) {
      return NextResponse.json({ error: `Invalid setting key: ${key}` }, { status: 400 })
    }

    if (value === undefined) {
      return NextResponse.json({ error: "value is required" }, { status: 400 })
    }

    // Type validation
    if (key === 'tax_rate' && (typeof value !== 'number' || value < 0 || value > 1)) {
      return NextResponse.json({ error: "tax_rate must be a number between 0 and 1" }, { status: 400 })
    }

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      // Check if setting already exists
      const [existing] = await tx
        .select()
        .from(organizationSettings)
        .where(
          and(
            eq(organizationSettings.organizationId, organizationId),
            eq(organizationSettings.key, key)
          )
        )
        .limit(1)

      let savedResult
      if (existing) {
        // Update
        [savedResult] = await tx
          .update(organizationSettings)
          .set({ value, updatedAt: new Date() })
          .where(eq(organizationSettings.id, existing.id))
          .returning()
      } else {
        // Create
        [savedResult] = await tx
          .insert(organizationSettings)
          .values({ organizationId, key, value })
          .returning()
      }

      // Log the action
      try {
        await tx.insert(auditLogs).values({
          action: existing ? "UPDATE_SETTING" : "CREATE_SETTING",
          entity: "organization_settings",
          entityId: String(savedResult.id),
          organizationId,
          metadata: { key, value },
          userId: user.id
        })
      } catch (auditError) {
        console.error("Audit log error:", auditError)
      }

      return { data: savedResult, wasUpdate: !!existing }
    })

    return NextResponse.json({
      data: (result as any).data,
      message: (result as any).wasUpdate ? "Setting updated successfully" : "Setting created successfully"
    })
  } catch (error: any) {
    console.error("Settings POST Error:", error)
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 })
  }
}

/**
 * DELETE /api/v1/settings - Delete setting (SUPER_ADMIN only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = req.nextUrl
    const idParam = searchParams.get("id")

    if (!idParam) return NextResponse.json({ error: "Setting id is required" }, { status: 400 })

    const id = parseInt(idParam, 10)
    if (isNaN(id)) return NextResponse.json({ error: "Invalid setting id" }, { status: 400 })

    const deleted = await withSuperAdmin(async (tx) => {
      // Check if setting exists
      const [existing] = await tx
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.id, id))
        .limit(1)

      if (!existing) {
        throw new Error("Setting not found")
      }

      const [removed] = await tx
        .delete(organizationSettings)
        .where(eq(organizationSettings.id, id))
        .returning()

      // Log the action
      await tx.insert(auditLogs).values({
        action: "DELETE_SETTING",
        entity: "organization_settings",
        entityId: String(id),
        organizationId: removed.organizationId,
        metadata: { key: removed.key },
        userId: user.id
      })

      return removed
    })

    return NextResponse.json({
      message: "Setting deleted successfully",
      deletedKey: deleted.key
    })
  } catch (error: any) {
    console.error("Settings DELETE Error:", error)
    const status = error.message === "Setting not found" ? 404 : 500
    return NextResponse.json({ error: error.message || "Failed to delete setting" }, { status })
  }
}

