import { db } from "@/lib/db"
import { organizationSettings, auditLogs } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { ok, err, requireApiRole } from "@/lib/api"
import { NextRequest } from "next/server"
import { handleError } from "@/lib/error-handler"
import { logError } from "@/lib/global-logger"

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
 * Validate setting key
 */
function isValidSettingKey(key: string): boolean {
  return VALID_SETTING_KEYS.has(key)
}

/**
 * GET /api/v1/settings - Fetch organization settings
 */
export async function GET(req: NextRequest) {
  const authErr = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (authErr) return authErr

  try {
    const { searchParams } = req.nextUrl
    const organizationIdParam = searchParams.get("organizationId")

    if (organizationIdParam) {
      // Validate organization ID
      const organizationId = parseInt(organizationIdParam, 10)
      if (isNaN(organizationId) || organizationId <= 0) {
        return err("Invalid organization ID", 400)
      }

      const settings = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))

      return ok({ data: settings })
    }

    // Return all settings
    const allSettings = await db.select().from(organizationSettings)
    return ok({ data: allSettings })
  } catch (e) {
    logError(e, 'SETTINGS_GET')
    return handleError(e, 'SETTINGS_GET')
  }
}

/**
 * POST /api/v1/settings - Create or update setting
 */
export async function POST(req: NextRequest) {
  const authErr = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE"])
  if (authErr) return authErr

  try {
    const body = await req.json()
    const { organizationId, key, value } = body

    // Validate required fields
    if (!organizationId) {
      return err("organizationId is required", 400)
    }

    if (!key || typeof key !== 'string') {
      return err("key is required and must be a string", 400)
    }

    // Validate organization ID
    if (typeof organizationId !== 'number' || organizationId <= 0) {
      return err("organizationId must be a positive number", 400)
    }

    // Validate setting key
    if (!isValidSettingKey(key)) {
      return err(`Invalid setting key: ${key}. Must be one of: ${Array.from(VALID_SETTING_KEYS).join(', ')}`, 400)
    }

    // Validate value is not undefined
    if (value === undefined) {
      return err("value is required", 400)
    }

    // Type validation based on key
    if (key === 'tax_rate' && (typeof value !== 'number' || value < 0 || value > 1)) {
      return err("tax_rate must be a number between 0 and 1", 400)
    }

    if (key === 'order_approval_threshold' && (typeof value !== 'number' || value < 0)) {
      return err("order_approval_threshold must be a non-negative number", 400)
    }

    if (key === 'session_timeout_minutes' && (typeof value !== 'number' || value < 1 || value > 1440)) {
      return err("session_timeout_minutes must be between 1 and 1440 (24 hours)", 400)
    }

    if (key === 'low_stock_threshold' && (typeof value !== 'number' || value < 0)) {
      return err("low_stock_threshold must be a non-negative number", 400)
    }

    if (['auto_approve_orders', 'require_mfa', 'enable_notifications'].includes(key) && typeof value !== 'boolean') {
      return err(`${key} must be a boolean`, 400)
    }

    if (key === 'default_currency' && (typeof value !== 'string' || value.length !== 3)) {
      return err("default_currency must be a 3-letter currency code", 400)
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
    try {
      await db.insert(auditLogs).values({
        action: existing.length > 0 ? "UPDATE_SETTING" : "CREATE_SETTING",
        entity: "organization_settings",
        entityId: result.id.toString(),
        organizationId,
        metadata: { key, value },
      })
    } catch (auditError) {
      // Log but don't fail the request
      logError(auditError, 'SETTINGS_AUDIT_LOG')
    }

    return ok({
      data: result,
      message: existing.length > 0 ? "Setting updated successfully" : "Setting created successfully"
    })
  } catch (error: any) {
    if (error?.name === 'SyntaxError') {
      return err("Invalid JSON in request body", 400)
    }
    logError(error, 'SETTINGS_POST')
    return err(error.message || "Failed to save setting", 500)
  }
}

/**
 * DELETE /api/v1/settings - Delete setting
 */
export async function DELETE(req: NextRequest) {
  const authErr = await requireApiRole(["SUPER_ADMIN"])
  if (authErr) return authErr

  try {
    const { searchParams } = req.nextUrl
    const idParam = searchParams.get("id")

    if (!idParam) {
      return err("Setting id is required", 400)
    }

    // Validate ID
    const id = parseInt(idParam, 10)
    if (isNaN(id) || id <= 0) {
      return err("Invalid setting id", 400)
    }

    // Check if setting exists
    const existing = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.id, id))
      .limit(1)

    if (existing.length === 0) {
      return err("Setting not found", 404)
    }

    const [deleted] = await db
      .delete(organizationSettings)
      .where(eq(organizationSettings.id, id))
      .returning()

    // Log the action
    try {
      await db.insert(auditLogs).values({
        action: "DELETE_SETTING",
        entity: "organization_settings",
        entityId: id.toString(),
        organizationId: deleted.organizationId,
        metadata: { key: deleted.key }
      })
    } catch (auditError) {
      // Log but don't fail the request
      logError(auditError, 'SETTINGS_AUDIT_LOG')
    }

    return ok({
      message: "Setting deleted successfully",
      deletedKey: deleted.key
    })
  } catch (error: any) {
    logError(error, 'SETTINGS_DELETE')
    return err(error.message || "Failed to delete setting", 500)
  }
}
