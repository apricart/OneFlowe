import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { branches as branchesTable, organizations } from "@/db/schema"
import { and, desc, eq, sql, inArray } from "drizzle-orm"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole, organizationId: userOrgId, branchId: userBranchId } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN", "ORDER_PORTAL"]
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const organizationIdRaw = searchParams.get("organizationId") || undefined
    const groupIdsRaw = searchParams.get("groupIds") || undefined

    // Validate organization ID parameter
    let orgIds: number[] = []
    if (organizationIdRaw) {
      const ids = organizationIdRaw.split(',').map(id => id.trim())
      for (const id of ids) {
        if (!/^\d+$/.test(id)) {
          return NextResponse.json({ error: "Invalid organization ID format" }, { status: 400 })
        }
        const n = Number(id)
        if (n <= 0) {
          return NextResponse.json({ error: "Organization ID must be positive" }, { status: 400 })
        }
        orgIds.push(n)
      }
    }

    // Validate group IDs parameter
    let groupIds: number[] = []
    if (groupIdsRaw) {
      groupIds = groupIdsRaw.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id) && id > 0)
    }

    // Determine scoped org/branch
    const scopedOrgIds = role === "SUPER_ADMIN"
      ? orgIds.length ? orgIds : undefined
      : (userOrgId ? [userOrgId] : undefined)

    const scopedBranchId = role === "BRANCH_ADMIN" ? userBranchId : undefined

    if ((role === "HEAD_OFFICE" || role === "BRANCH_ADMIN") && (!scopedOrgIds || scopedOrgIds.length === 0)) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }

    if (role === "BRANCH_ADMIN" && !scopedBranchId) {
      return NextResponse.json({ error: "Branch context required" }, { status: 403 })
    }

    const cacheKey = scopedCacheKey(
      'branches',
      { role, branchId: scopedBranchId },
      { orgIds: scopedOrgIds?.join(','), groupIds: groupIds.join(',') }
    )

    const result = await getCached(cacheKey, async () => {
      return await withTenant(session.user as any, async (tx) => {
        const items = await tx
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
            scopedOrgIds && scopedOrgIds.length > 0
              ? (scopedOrgIds.length === 1
                  ? eq(branchesTable.organizationId, scopedOrgIds[0])
                  : inArray(branchesTable.organizationId, scopedOrgIds))
              : undefined,
            groupIds.length > 0 ? inArray(branchesTable.groupId, groupIds) : undefined,
            scopedBranchId ? eq(branchesTable.id, scopedBranchId) : undefined
          ))
          .orderBy(desc(branchesTable.createdAt))

        return { items, count: items.length }
      })
    }, CACHE_TTL.LISTING)

    return NextResponse.json(result)
  } catch (e: any) {
    console.error("Error fetching branches:", e)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()

    if (!body?.organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 })
    }

    const organizationId = Number(body.organizationId)
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      return NextResponse.json({ error: "Organization ID must be a positive integer" }, { status: 400 })
    }

    const name = String(body.name || "").trim()
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "Branch name must be between 2 and 100 characters" }, { status: 400 })
    }

    const validStatuses = ['active', 'inactive']
    const status = body.status ? String(body.status).toLowerCase() : 'active'
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    const item = await withSuperAdmin(async (tx) => {
      // Verify organization exists
      const [org] = await tx
        .select({ id: organizations.id, name: organizations.name, code: organizations.code })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)

      if (!org) {
        throw new Error(`Organization with ID ${organizationId} not found`)
      }

      // Auto-generate code
      const [{ count: branchCount }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(branchesTable)
        .where(eq(branchesTable.organizationId, organizationId))

      const nextNumber = (Number(branchCount) + 1).toString().padStart(2, '0')
      const generatedCode = `${org.code}-${nextNumber}`

      const existing = await tx
        .select({ id: branchesTable.id })
        .from(branchesTable)
        .where(and(
          eq(branchesTable.organizationId, organizationId),
          eq(branchesTable.code, generatedCode)
        ))
        .limit(1)

      let finalCode = generatedCode
      if (existing.length > 0) {
        finalCode = `${org.code}-${nextNumber}-${Date.now().toString().slice(-4)}`
      }

      const [newBranch] = await tx
        .insert(branchesTable)
        .values({ organizationId, name, code: finalCode, status })
        .returning()

      return newBranch
    })

    await invalidateByPrefix('branches')

    return NextResponse.json({ item, message: "Branch created successfully" }, { status: 201 })
  } catch (e: any) {
    if (e.code === '23505') {
      return NextResponse.json({ error: "Branch with this code already exists in this organization" }, { status: 409 })
    }
    if (e.code === '23503') {
      return NextResponse.json({ error: "Referenced organization does not exist" }, { status: 404 })
    }
    if (e.message?.includes('not found')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    console.error("Error creating branch:", e)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
