import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withTenant } from "@/lib/db"
import { groups, groupAuditLogs, branches, organizations } from "@/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { role: userRole, organizationId: userOrgId } = session.user as any
        const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

        let orgId = role === "SUPER_ADMIN" ? null : userOrgId
        const { searchParams } = new URL(req.url)
        const orgIdParam = searchParams.get("organizationId")

        if (orgIdParam && role === "SUPER_ADMIN") {
            const parsedOrgId = parseInt(orgIdParam)
            if (Number.isFinite(parsedOrgId)) {
                orgId = parsedOrgId
            }
        }

        if (!orgId && role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Organization ID required" }, { status: 400 })
        }

        const cacheKey = scopedCacheKey('groups', { orgId: orgId })

        const allGroups = await getCached(cacheKey, async () => {
            return await withTenant(session.user as any, async (tx) => {
                return tx
                    .select({
                        id: groups.id,
                        organizationId: groups.organizationId,
                        organizationName: organizations.name,
                        name: groups.name,
                        description: groups.description,
                        status: sql<string>`CASE 
                            WHEN ${groups.status} = 'deleted' THEN 'deleted'
                            WHEN count(${branches.id}) > 0 THEN 'connected'
                            ELSE 'not connected'
                        END`,
                        createdAt: groups.createdAt,
                        updatedAt: groups.updatedAt,
                        branchCount: sql<number>`count(${branches.id})::int`,
                    })
                    .from(groups)
                    .innerJoin(organizations, eq(groups.organizationId, organizations.id))
                    .leftJoin(branches, eq(branches.groupId, groups.id))
                    .where(
                        and(
                            orgId ? eq(groups.organizationId, orgId) : undefined,
                            sql`${groups.status} != 'deleted'`
                        )
                    )
                    .groupBy(groups.id, organizations.id)
                    .orderBy(groups.name)
            })
        }, CACHE_TTL.LISTING)

        return NextResponse.json({ groups: allGroups })
    } catch (e: any) {
        console.error("Error fetching groups:", e)
        return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { role: userRole, id: userId, organizationId: userOrgId } = session.user as any
        const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

        if (role !== "SUPER_ADMIN" && role !== "HEAD_OFFICE") {
            return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 })
        }

        const body = await req.json()
        let { organizationId, name, description } = body

        // HEAD_OFFICE can only create groups in their own organization
        if (role === "HEAD_OFFICE") {
            organizationId = userOrgId
        }

        if (!organizationId || !name) {
            return NextResponse.json({ error: "Organization ID and name are required" }, { status: 400 })
        }

        const newGroup = await withTenant(session.user as any, async (tx) => {
            // Check for duplicate
            const [existingGroup] = await tx
                .select()
                .from(groups)
                .where(
                    and(
                        eq(groups.organizationId, organizationId),
                        sql`lower(${groups.name}) = lower(${name})`,
                        sql`${groups.status} != 'deleted'`
                    )
                )
                .limit(1)

            if (existingGroup) {
                throw new Error(`A group named "${name}" already exists.`)
            }

            const [created] = await tx.insert(groups).values({
                organizationId,
                name,
                description,
                status: "not connected",
                createdByUserId: userId,
            }).returning()

            await tx.insert(groupAuditLogs).values({
                organizationId,
                groupId: created.id,
                action: "CREATE_GROUP",
                performedByUserId: userId,
                performedByRole: role,
                metadata: { name, description },
            })

            return created
        })

        await invalidateByPrefix('group')

        return NextResponse.json({ group: newGroup })
    } catch (e: any) {
        if (e.message?.includes('already exists')) {
            return NextResponse.json({ error: e.message }, { status: 409 })
        }
        console.error("Error creating group:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
