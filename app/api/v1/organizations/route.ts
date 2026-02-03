import { ok, error, requireApiRole, readJson } from "@/lib/api"
import { db } from "@/lib/db"
import { organizations as orgsTable } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
import { handleError } from "@/lib/error-handler"
import { logError } from "@/lib/global-logger"

/**
 * GET /api/v1/organizations - List organizations
 */
export async function GET() {
  try {
    const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
    if (err) return err

    const scope = await getRequestScope()

    // Validate scope data
    if (!scope?.role) {
      logError(new Error('Missing role in request scope'), 'ORGANIZATIONS_GET')
      return error("Invalid session data", 401)
    }

    // SUPER_ADMIN sees all, others see only their organization
    const where = scope.role === "SUPER_ADMIN"
      ? undefined as any
      : scope.organizationId
        ? eq(orgsTable.id, Number(scope.organizationId))
        : undefined as any

    // Validate organizationId for non-SUPER_ADMIN users
    if (scope.role !== "SUPER_ADMIN" && !scope.organizationId) {
      return error("Organization context required", 403)
    }

    const items = await db
      .select()
      .from(orgsTable)
      .where(where)
      .orderBy(desc(orgsTable.createdAt))

    return ok({
      items,
      count: items.length
    })
  } catch (e: any) {
    logError(e, 'ORGANIZATIONS_GET')
    return handleError(e, 'ORGANIZATIONS_GET')
  }
}

/**
 * POST /api/v1/organizations - Create new organization
 */
export async function POST(req: Request) {
  try {
    const err = await requireApiRole(["SUPER_ADMIN"]) // Only Super Admin can create organizations
    if (err) return err

    const body = await readJson<any>(req)

    // Validate required fields
    if (!body?.name || typeof body.name !== 'string') {
      return error("Organization name is required and must be a string", 400)
    }

    if (!body?.code || typeof body.code !== 'string') {
      return error("Organization code is required and must be a string", 400)
    }

    // Validate field lengths
    const name = String(body.name).trim()
    const code = String(body.code).trim().toUpperCase()

    if (name.length < 2 || name.length > 100) {
      return error("Organization name must be between 2 and 100 characters", 400)
    }

    if (code.length < 2 || code.length > 20) {
      return error("Organization code must be between 2 and 20 characters", 400)
    }

    // Validate code format (alphanumeric and underscores only)
    if (!/^[A-Z0-9_]+$/.test(code)) {
      return error("Organization code must contain only uppercase letters, numbers, and underscores", 400)
    }

    // Validate status if provided
    const validStatuses = ['active', 'inactive', 'suspended']
    const status = body.status ? String(body.status).toLowerCase() : 'active'

    if (!validStatuses.includes(status)) {
      return error(`Status must be one of: ${validStatuses.join(', ')}`, 400)
    }

    // Check for duplicate name
    const existingName = await db
      .select({ id: orgsTable.id })
      .from(orgsTable)
      .where(eq(orgsTable.name, name))
      .limit(1)

    if (existingName.length > 0) {
      return error(`Organization with name '${name}' already exists`, 400)
    }

    // Check for duplicate code
    const existingCode = await db
      .select({ id: orgsTable.id })
      .from(orgsTable)
      .where(eq(orgsTable.code, code))
      .limit(1)

    if (existingCode.length > 0) {
      return error(`Organization with code '${code}' already exists`, 400)
    }

    // Insert organization
    const [item] = await db
      .insert(orgsTable)
      .values({
        name,
        code,
        status
      })
      .returning()

    return ok({
      item,
      message: "Organization created successfully"
    }, { status: 201 })

  } catch (e: any) {
    // Handle database constraint violations
    if (e.code === '23505') { // Unique violation
      return error("Organization with this code already exists", 409)
    }

    logError(e, 'ORGANIZATIONS_POST')
    return handleError(e, 'ORGANIZATIONS_POST')
  }
}
