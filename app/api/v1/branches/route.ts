import { ok, error, readJson, requireApiRole } from "@/lib/api"
export const dynamic = 'force-dynamic'
import { db } from "@/lib/db"
import { branches as branchesTable, organizations } from "@/db/schema"
import { and, desc, eq, sql } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
import { handleError } from "@/lib/error-handler"
import { logError } from "@/lib/global-logger"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"

/**
 * GET /api/v1/branches - List branches with access control
 */
export async function GET(req: Request) {
  try {
    const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN", "ORDER_PORTAL"])
    if (err) return err

    const { searchParams } = new URL(req.url)
    const organizationIdRaw = searchParams.get("organizationId") || undefined

    // Validate organization ID parameter
    let orgIdNum: number | undefined
    if (organizationIdRaw) {
      if (!/^\d+$/.test(organizationIdRaw)) {
        return error("Invalid organization ID format", 400)
      }
      orgIdNum = Number(organizationIdRaw)
      if (orgIdNum <= 0) {
        return error("Organization ID must be positive", 400)
      }
    }

    const scope = await getRequestScope()

    // Validate scope
    if (!scope?.role) {
      logError(new Error('Missing role in request scope'), 'BRANCHES_GET')
      return error("Invalid session data", 401)
    }

    // Determine which organization to query based on role
    const scopedOrgId = scope.role === "SUPER_ADMIN"
      ? orgIdNum
      : (scope.organizationId ?? undefined)

    const scopedBranchId = scope.role === "BRANCH_ADMIN"
      ? scope.branchId
      : undefined

    // HEAD_OFFICE and BRANCH_ADMIN must have organization context
    if ((scope.role === "HEAD_OFFICE" || scope.role === "BRANCH_ADMIN") && !scopedOrgId) {
      return error("Organization context required", 403)
    }

    // BRANCH_ADMIN must have branch context
    if (scope.role === "BRANCH_ADMIN" && !scopedBranchId) {
      return error("Branch context required", 403)
    }

    const cacheKey = scopedCacheKey('branches', { role: scope.role, orgId: scopedOrgId, branchId: scopedBranchId })

    const result = await getCached(cacheKey, async () => {
      const items = await db
        .select({
          id: branchesTable.id,
          organizationId: branchesTable.organizationId,
          name: branchesTable.name,
          code: branchesTable.code,
          status: branchesTable.status,
          groupId: branchesTable.groupId,
          adminUserId: branchesTable.adminUserId,
          createdAt: branchesTable.createdAt,
          updatedAt: branchesTable.updatedAt,
          groupName: sql<string | null>`(
            SELECT name FROM groups WHERE id = ${branchesTable.groupId}
          )`,
        })
        .from(branchesTable)
        .where(and(
          scopedOrgId ? eq(branchesTable.organizationId, scopedOrgId) : undefined,
          scopedBranchId ? eq(branchesTable.id, scopedBranchId) : undefined
        ))
        .orderBy(desc(branchesTable.createdAt))

      return { items, count: items.length }
    }, CACHE_TTL.LISTING)

    return ok(result)
  } catch (e: any) {
    logError(e, 'BRANCHES_GET')
    return handleError(e, 'BRANCHES_GET')
  }
}

/**
 * POST /api/v1/branches - Create new branch
 */
export async function POST(req: Request) {
  try {
    const err = await requireApiRole(["SUPER_ADMIN"])
    if (err) return err

    const body = await readJson<any>(req)

    // Validate required fields
    if (!body?.name || typeof body.name !== 'string') {
      return error("Branch name is required and must be a string", 400)
    }

    if (!body?.code || typeof body.code !== 'string') {
      return error("Branch code is required and must be a string", 400)
    }

    if (!body?.organizationId) {
      return error("Organization ID is required", 400)
    }

    // Validate organizationId type
    const organizationId = Number(body.organizationId)
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      return error("Organization ID must be a positive integer", 400)
    }

    // Validate field format and length
    const name = String(body.name).trim()
    const code = String(body.code).trim().toUpperCase()

    if (name.length < 2 || name.length > 100) {
      return error("Branch name must be between 2 and 100 characters", 400)
    }

    if (code.length < 2 || code.length > 20) {
      return error("Branch code must be between 2 and 20 characters", 400)
    }

    // Validate code format (alphanumeric and underscores/hyphens)
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      return error("Branch code must contain only uppercase letters, numbers, underscores, and hyphens", 400)
    }

    // Validate status
    const validStatuses = ['active', 'inactive']
    const status = body.status ? String(body.status).toLowerCase() : 'active'

    if (!validStatuses.includes(status)) {
      return error(`Status must be one of: ${validStatuses.join(', ')}`, 400)
    }

    // Verify organization exists
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (!org) {
      return error(`Organization with ID ${organizationId} not found`, 404)
    }

    // Check for duplicate code within the same organization
    const existing = await db
      .select({ id: branchesTable.id, code: branchesTable.code })
      .from(branchesTable)
      .where(and(
        eq(branchesTable.organizationId, organizationId),
        eq(branchesTable.code, code)
      ))
      .limit(1)

    if (existing.length > 0) {
      return error(`Branch with code '${code}' already exists in this organization`, 409)
    }

    // Insert branch
    const [item] = await db
      .insert(branchesTable)
      .values({
        organizationId,
        name,
        code,
        status,
      })
      .returning()

    // Invalidate branches cache
    await invalidateByPrefix('branches')

    return ok({
      item,
      message: "Branch created successfully"
    }, { status: 201 })

  } catch (e: any) {
    // Handle database constraint violations
    if (e.code === '23505') { // Unique violation
      return error("Branch with this code already exists in this organization", 409)
    }

    if (e.code === '23503') { // Foreign key violation
      return error("Referenced organization does not exist", 404)
    }

    logError(e, 'BRANCHES_POST')
    return handleError(e, 'BRANCHES_POST')
  }
}
