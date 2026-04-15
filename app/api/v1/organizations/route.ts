export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { organizations as orgsTable } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"
import { getRequestScope } from "@/lib/auth"


export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN", "ORDER_PORTAL"]
    if (!allowedRoles.includes(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (scope.role !== "SUPER_ADMIN" && !scope.organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }

    const { role, organizationId } = scope
    const cacheKey = scopedCacheKey('organizations', { role, orgId: organizationId })

    const result = await getCached(cacheKey, async () => {
      return await (role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

      async function handler(tx: any) {
        const where = role === "SUPER_ADMIN"
          ? undefined
          : organizationId
            ? eq(orgsTable.id, Number(organizationId))
            : undefined

        const items = await tx
          .select()
          .from(orgsTable)
          .where(where)
          .orderBy(desc(orgsTable.createdAt))

        return { items, count: items.length }
      }
    }, CACHE_TTL.LISTING)

    return NextResponse.json(result)

  } catch (e: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope || scope.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { name, code } = body

    if (!name || typeof name !== 'string') return NextResponse.json({ error: "Organization name is required" }, { status: 400 })
    if (!code || typeof code !== 'string') return NextResponse.json({ error: "Organization code is required" }, { status: 400 })

    const sanitizedName = name.trim()
    const sanitizedCode = code.trim().toUpperCase()

    if (sanitizedName.length < 2 || sanitizedName.length > 100) return NextResponse.json({ error: "Organization name must be between 2 and 100 characters" }, { status: 400 })
    if (sanitizedCode.length < 2 || sanitizedCode.length > 20) return NextResponse.json({ error: "Organization code must be between 2 and 20 characters" }, { status: 400 })
    if (!/^[A-Z0-9_]+$/.test(sanitizedCode)) return NextResponse.json({ error: "Organization code must contain only uppercase letters, numbers, and underscores" }, { status: 400 })

    const validStatuses = ['active', 'inactive', 'suspended']
    const status = body.status ? String(body.status).toLowerCase() : 'active'
    if (!validStatuses.includes(status)) return NextResponse.json({ error: `Status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })

    const result = await withSuperAdmin(async (tx) => {
      // Check for duplicate name
      const [existingName] = await tx.select({ id: orgsTable.id }).from(orgsTable).where(eq(orgsTable.name, sanitizedName)).limit(1)
      if (existingName) throw new Error(`Organization with name '${sanitizedName}' already exists`)

      // Check for duplicate code
      const [existingCode] = await tx.select({ id: orgsTable.id }).from(orgsTable).where(eq(orgsTable.code, sanitizedCode)).limit(1)
      if (existingCode) throw new Error(`Organization with code '${sanitizedCode}' already exists`)

      const [newOrg] = await tx.insert(orgsTable).values({ name: sanitizedName, code: sanitizedCode, status }).returning()
      return newOrg
    })

    await invalidateByPrefix('organizations')
    return NextResponse.json({ item: result, message: "Organization created successfully" }, { status: 201 })
  } catch (e: any) {
    if (e.message?.includes('already exists')) return NextResponse.json({ error: e.message }, { status: 400 })
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}

