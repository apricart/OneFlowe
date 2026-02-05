import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { groups, branches, orders, organizations } from "@/db/schema"
import { and, eq, sql, isNull, gte, lte } from "drizzle-orm"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const role = (session.user as any).role
        let orgId = role === "SUPER_ADMIN" ? null : (session.user as any).organizationId
        const { searchParams } = new URL(req.url)
        const orgIdParam = searchParams.get("organizationId")
        const groupIdParam = searchParams.get("groupId")
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")

        if (orgIdParam && role === "SUPER_ADMIN") {
            const parsedOrgId = parseInt(orgIdParam)
            if (Number.isFinite(parsedOrgId)) orgId = parsedOrgId
        }

        if (!orgId && role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Organization ID required" }, { status: 400 })
        }

        // Build order conditions for date filtering
        const orderConditions = []

        // Only include FULFILLED orders for accurate revenue reporting
        orderConditions.push(sql`UPPER(${orders.status}) = 'FULFILLED'`)

        if (startDate) {
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            orderConditions.push(gte(orders.createdAt, start))
        }
        if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            orderConditions.push(lte(orders.createdAt, end))
        }

        const orderWhere = orderConditions.length > 0 ? and(...orderConditions) : undefined

        // Build group conditions
        const groupConditions = []
        groupConditions.push(sql`${groups.status} != 'deleted'`)
        if (orgId) {
            groupConditions.push(eq(groups.organizationId, orgId))
        }
        if (groupIdParam && groupIdParam !== "all") {
            groupConditions.push(eq(groups.id, Number(groupIdParam)))
        }

        // 1. Fetch Group stats with branch-level breakdown in a single query if possible, 
        // or a more efficient approach. Actually, Postgres allows us to aggregate branches into a JSON array.

        const groupStats = await db
            .select({
                id: groups.id,
                name: groups.name,
                organizationId: groups.organizationId,
                organizationName: organizations.name,
                totalOrders: sql<number>`count(${orders.id})::int`,
                totalAmountCents: sql<number>`coalesce(sum(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)::int`,
                branchCount: sql<number>`count(distinct ${branches.id})::int`,
                // Optimization: Aggregate branch data into a JSON array within the main query
                branches: sql<any>`
                    COALESCE(
                        JSON_AGG(
                            DISTINCT JSONB_BUILD_OBJECT(
                                'id', ${branches.id},
                                'name', ${branches.name}
                            )
                        ) FILTER (WHERE ${branches.id} IS NOT NULL),
                        '[]'
                    )
                `
            })
            .from(groups)
            .leftJoin(organizations, eq(groups.organizationId, organizations.id))
            .leftJoin(branches, eq(branches.groupId, groups.id))
            .leftJoin(orders, and(
                eq(orders.branchId, branches.id),
                orderWhere
            ))
            .where(and(...groupConditions))
            .groupBy(groups.id, organizations.id)
            .orderBy(sql`coalesce(sum(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)::int desc`)

        // 2. Fetch specific branch-level revenue/order counts separately but in ONE query per group type if needed, 
        // or refine the aggregation above. The current approach above gets branch names but not their individual stats.
        // Let's do a separate query for branches stats to avoid heavy grouping complexity in one.

        const groupIds = groupStats.map(g => g.id)

        const branchStatsMap: Record<number, any[]> = {}
        if (groupIds.length > 0) {
            const allBranchStats = await db
                .select({
                    id: branches.id,
                    name: branches.name,
                    groupId: branches.groupId,
                    orders: sql<number>`count(${orders.id})::int`,
                    revenue: sql<number>`coalesce(sum(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)::int`,
                })
                .from(branches)
                .leftJoin(orders, and(
                    eq(orders.branchId, branches.id),
                    orderWhere
                ))
                .where(sql`${branches.groupId} IN ${groupIds}`)
                .groupBy(branches.id)
                .orderBy(sql`coalesce(sum(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)::int desc`)

            allBranchStats.forEach(bs => {
                if (bs.groupId) {
                    if (!branchStatsMap[bs.groupId]) branchStatsMap[bs.groupId] = []
                    branchStatsMap[bs.groupId].push(bs)
                }
            })
        }

        const groupsWithBranches = groupStats.map(group => ({
            ...group,
            branches: branchStatsMap[group.id] || []
        }))

        // 3. Calculate summary statistics
        const totalGroups = groupsWithBranches.length
        const totalOrders = groupsWithBranches.reduce((sum, g) => sum + g.totalOrders, 0)
        const totalRevenue = groupsWithBranches.reduce((sum, g) => sum + g.totalAmountCents, 0)
        const avgRevenuePerGroup = totalGroups > 0 ? Math.round(totalRevenue / totalGroups) : 0

        // 4. Fetch stats for branches NOT in any group (ungrouped branches)
        const ungroupedConditions = []
        if (orgId) {
            ungroupedConditions.push(eq(branches.organizationId, orgId))
        }
        ungroupedConditions.push(isNull(branches.groupId))
        ungroupedConditions.push(eq(branches.status, 'active'))

        const ungroupedStats = await db
            .select({
                id: branches.id,
                name: branches.name,
                organizationId: branches.organizationId,
                organizationName: organizations.name,
                totalOrders: sql<number>`count(${orders.id})::int`,
                totalAmountCents: sql<number>`coalesce(sum(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)::int`,
            })
            .from(branches)
            .leftJoin(organizations, eq(branches.organizationId, organizations.id))
            .leftJoin(orders, and(
                eq(orders.branchId, branches.id),
                orderWhere
            ))
            .where(and(...ungroupedConditions))
            .groupBy(branches.id, organizations.id)
            .orderBy(sql`coalesce(sum(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)::int desc`)

        return NextResponse.json({
            summary: {
                totalGroups,
                totalOrders,
                totalRevenue,
                avgRevenuePerGroup
            },
            groups: groupsWithBranches,
            ungroupedBranches: ungroupedStats
        })

    } catch (e: any) {
        console.error("Error in group analytics API:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
