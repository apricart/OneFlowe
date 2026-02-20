import { ok, error, readJson, requireApiRole } from "@/lib/api"
export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
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
    logError(e, 'BRANCHES_GET')
    const { status, ...errorBody } = handleError(e, 'BRANCHES_GET')
    return NextResponse.json(errorBody, { status })
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
    if (!body?.organizationId) {
      return error("Organization ID is required", 400)
    }

    // Validate organizationId type
    const organizationId = Number(body.organizationId)
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      return error("Organization ID must be a positive integer", 400)
    }

    // Validate field format and length
    const name = String(body.name || "").trim()
    if (name.length < 2 || name.length > 100) {
      return error("Branch name must be between 2 and 100 characters", 400)
    }

    // Validate status
    const validStatuses = ['active', 'inactive']
    const status = body.status ? String(body.status).toLowerCase() : 'active'
    if (!validStatuses.includes(status)) {
      return error(`Status must be one of: ${validStatuses.join(', ')}`, 400)
    }

    // Verify organization exists and get its code
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, code: organizations.code })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (!org) {
      return error(`Organization with ID ${organizationId} not found`, 404)
    }

    // Auto-generate code if not provided or to ensure standardization
    // Format: {ORG_CODE}-{COUNT+1}
    const [{ count: branchCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(branchesTable)
      .where(eq(branchesTable.organizationId, organizationId))

    const nextNumber = (Number(branchCount) + 1).toString().padStart(2, '0')
    const generatedCode = `${org.code}-${nextNumber}`

    // Double check for duplicate code (just in case of race conditions)
    const existing = await db
      .select({ id: branchesTable.id })
      .from(branchesTable)
      .where(and(
        eq(branchesTable.organizationId, organizationId),
        eq(branchesTable.code, generatedCode)
      ))
      .limit(1)

    let finalCode = generatedCode
    if (existing.length > 0) {
      // If collision, add a timestamp or more padding
      finalCode = `${org.code}-${nextNumber}-${Date.now().toString().slice(-4)}`
    }

    // Insert branch
    const [item] = await db
      .insert(branchesTable)
      .values({
        organizationId,
        name,
        code: finalCode,
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
    logError(e, 'BRANCHES_POST')
    const { status, ...errorBody } = handleError(e, 'BRANCHES_POST')
    return NextResponse.json(errorBody, { status })
  }
}
