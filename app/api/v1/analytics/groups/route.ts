import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { groups, branches, orders, organizations } from "@/db/schema"
import { and, eq, sql, isNull, gte, lte, desc, inArray } from "drizzle-orm"
import { metricExpressions, REVENUE_ELIGIBLE_FILTER } from "@/lib/metric-utils"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const role = (session.user as any).role
        let orgId = role === "SUPER_ADMIN" ? null : (session.user as any).organizationId
        const { searchParams } = new URL(req.url)
        const orgIdParam = searchParams.get("organizationId")
        const groupIdsParam = searchParams.get("groupIds")
        const branchIdsParam = searchParams.get("branchIds")
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")
        const compare = searchParams.get("compare") === "true"
        const compareStartDateParam = searchParams.get("compareStartDate")
        const compareEndDateParam = searchParams.get("compareEndDate")

        const monthsRaw = searchParams.get("months")
        const yearsRaw = searchParams.get("years")
        const compareMonthsRaw = searchParams.get("compareMonths")
        const compareYearsRaw = searchParams.get("compareYears")

        const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter((n: any) => !isNaN(n) && n >= 1 && n <= 12) : []
        const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter((n: any) => !isNaN(n) && n > 2000) : []
        const parsedCompMonths = compareMonthsRaw ? compareMonthsRaw.split(',').map(Number).filter((n: any) => !isNaN(n) && n >= 1 && n <= 12) : []
        const parsedCompYears = compareYearsRaw ? compareYearsRaw.split(',').map(Number).filter((n: any) => !isNaN(n) && n > 2000) : []

        const summaryOnly = searchParams.get("summaryOnly") === "true"
        const trendOnly = searchParams.get("trendOnly") === "true"
        const allTime = searchParams.get("allTime") === "true"

        if (orgIdParam && role === "SUPER_ADMIN") {
            const parsedOrgId = parseInt(orgIdParam)
            if (Number.isFinite(parsedOrgId)) orgId = parsedOrgId
        }

        if (!orgId && role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Organization ID required" }, { status: 400 })
        }

        const parsedGroupIds = groupIdsParam ? groupIdsParam.split(',').map(Number).filter(id => !isNaN(id)) : []
        const parsedBranchIds = branchIdsParam ? branchIdsParam.split(',').map(Number).filter(id => !isNaN(id)) : []

        // ━━━ Mode: All Time (Year Selection) ━━━
        if (allTime) {
            const distinctYears = await db
                .select({ year: sql<number>`EXTRACT(YEAR FROM ${orders.createdAt})::int` })
                .from(orders)
                .innerJoin(branches, eq(orders.branchId, branches.id))
                .innerJoin(groups, eq(branches.groupId, groups.id))
                .where(and(
                    REVENUE_ELIGIBLE_FILTER,
                    orgId ? eq(groups.organizationId, orgId) : undefined
                ))
                .groupBy(sql`EXTRACT(YEAR FROM ${orders.createdAt})`)
                .orderBy(desc(sql`EXTRACT(YEAR FROM ${orders.createdAt})`))

            return NextResponse.json({
                years: distinctYears.map(y => y.year)
            })
        }

        // Build order conditions for date filtering
        const orderConditions: any[] = [REVENUE_ELIGIBLE_FILTER]
        
        if (parsedMonths.length > 0) {
            orderConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
        }
        if (parsedYears.length > 0) {
            orderConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
        }

        if (parsedMonths.length === 0 && parsedYears.length === 0) {
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
        }

        const orderWhere = and(...orderConditions)

        // Build group conditions
        const groupConditions = []
        if (orgId) {
            groupConditions.push(eq(groups.organizationId, orgId))
        }
        if (parsedGroupIds.length > 0) {
            groupConditions.push(sql`${groups.id} IN (${sql.join(parsedGroupIds, sql`, `)})`)
        }

        // ━━━ Mode: Trend Only (Bar Chart) ━━━
        if (trendOnly) {
            const trendData = await db
                .select({
                    date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
                    revenue: metricExpressions.revenue,
                    orders: metricExpressions.totalOrderCount,
                })
                .from(orders)
                .innerJoin(branches, eq(orders.branchId, branches.id))
                .innerJoin(groups, eq(branches.groupId, groups.id))
                .where(and(
                    orderWhere,
                    orgId ? eq(groups.organizationId, orgId) : undefined,
                    parsedGroupIds.length > 0 ? sql`${groups.id} IN (${sql.join(parsedGroupIds, sql`, `)})` : undefined,
                    parsedBranchIds.length > 0 ? sql`${branches.id} IN (${sql.join(parsedBranchIds, sql`, `)})` : undefined
                ))
                .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
                .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)

            let compareTrend: any[] = []
            if (compare) {
                let prevStart: Date, prevEnd: Date
                if (compareStartDateParam && compareEndDateParam) {
                    prevStart = new Date(compareStartDateParam); prevEnd = new Date(compareEndDateParam)
                } else if (startDate && endDate) {
                    const start = new Date(startDate); const end = new Date(endDate)
                    const duration = end.getTime() - start.getTime()
                    prevStart = new Date(start.getTime() - duration - 1); prevEnd = new Date(start.getTime() - 1)
                } else {
                    prevStart = new Date(); prevEnd = new Date()
                }

                compareTrend = await db
                    .select({
                        date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
                        revenue: metricExpressions.revenue,
                    })
                    .from(orders)
                    .innerJoin(branches, eq(orders.branchId, branches.id))
                    .innerJoin(groups, eq(branches.groupId, groups.id))
                    .where(and(
                        REVENUE_ELIGIBLE_FILTER,
                        orgId ? eq(groups.organizationId, orgId) : undefined,
                        parsedGroupIds.length > 0 ? sql`${groups.id} IN (${sql.join(parsedGroupIds, sql`, `)})` : undefined,
                        parsedBranchIds.length > 0 ? sql`${branches.id} IN (${sql.join(parsedBranchIds, sql`, `)})` : undefined,
                        (() => {
                            const compCond: any[] = []
                            if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) {
                                if (parsedCompMonths.length > 0) compCond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
                                if (parsedCompYears.length > 0) compCond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
                            } else {
                                compCond.push(gte(orders.createdAt, prevStart), lte(orders.createdAt, prevEnd))
                            }
                            return and(...compCond)
                        })()
                    ))
                    .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`)
            }

            return NextResponse.json({ trend: trendData, compareTrend })
        }

        // 1. Fetch Group stats with branch-level breakdown
        const groupStats = await db
            .select({
                id: groups.id,
                name: groups.name,
                status: groups.status,
                organizationId: groups.organizationId,
                organizationName: organizations.name,
                totalOrders: sql<number>`count(${orders.id})::int`,
                totalAmountCents: metricExpressions.revenue,
                totalRefundCents: sql<number>`coalesce(sum(${orders.refundAmountCents}), 0)::int`,
                rejectedOrders: sql<number>`count(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END)::int`,
                branchCount: sql<number>`count(distinct ${branches.id})::int`,
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
                orderWhere,
                parsedBranchIds.length > 0 ? inArray(orders.branchId, parsedBranchIds) : undefined
            ))
            .where(and(...groupConditions))
            .groupBy(groups.id, organizations.id)
            .orderBy(desc(metricExpressions.revenue))

        const groupIdsList = groupStats.map(g => g.id)
        const branchStatsMap: Record<number, any[]> = {}
        if (groupIdsList.length > 0) {
            const allBranchStats = await db
                .select({
                    id: branches.id,
                    name: branches.name,
                    status: branches.status,
                    groupId: branches.groupId,
                    orders: sql<number>`count(${orders.id})::int`,
                    revenue: metricExpressions.revenue,
                    refunds: sql<number>`coalesce(sum(${orders.refundAmountCents}), 0)::int`,
                    rejected: sql<number>`count(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END)::int`,
                })
                .from(branches)
                .leftJoin(orders, and(
                    eq(orders.branchId, branches.id),
                    orderWhere,
                    parsedBranchIds.length > 0 ? inArray(orders.branchId, parsedBranchIds) : undefined
                ))
                .where(sql`${branches.groupId} IN ${groupIdsList}`)
                .groupBy(branches.id)
                .orderBy(desc(metricExpressions.revenue))

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
        const totalRefunds = groupsWithBranches.reduce((sum, g) => sum + g.totalRefundCents, 0)
        const avgRevenuePerGroup = totalGroups > 0 ? Math.round(totalRevenue / totalGroups) : 0

        // 4. Ungrouped Branches (For summary too)
        const ungroupedConditions = []
        if (orgId) ungroupedConditions.push(eq(branches.organizationId, orgId))
        ungroupedConditions.push(isNull(branches.groupId), eq(branches.status, 'active'))

        const ungroupedStats = await db
            .select({
                id: branches.id,
                name: branches.name,
                organizationId: branches.organizationId,
                organizationName: organizations.name,
                totalOrders: sql<number>`count(${orders.id})::int`,
                totalAmountCents: metricExpressions.revenue,
            })
            .from(branches)
            .leftJoin(organizations, eq(branches.organizationId, organizations.id))
            .leftJoin(orders, and(eq(orders.branchId, branches.id), orderWhere))
            .where(and(...ungroupedConditions))
            .groupBy(branches.id, organizations.id)
            .orderBy(desc(metricExpressions.revenue))

        const totalUngroupedRevenue = ungroupedStats.reduce((sum, b) => sum + b.totalAmountCents, 0)
        const totalUngroupedOrders = ungroupedStats.reduce((sum, b) => sum + b.totalOrders, 0)

        // Comparison logic
        let comparisonSummary = null
        if (compare && (startDate || parsedCompMonths.length > 0)) {
            let prevStart: Date, prevEnd: Date
            if (compareStartDateParam && compareEndDateParam) {
                prevStart = new Date(compareStartDateParam); prevEnd = new Date(compareEndDateParam)
            } else if (startDate && endDate) {
                const duration = new Date(endDate).getTime() - new Date(startDate).getTime()
                prevStart = new Date(new Date(startDate).getTime() - duration - 1); prevEnd = new Date(new Date(startDate).getTime() - 1)
            } else {
                prevStart = new Date(); prevEnd = new Date()
            }

            const compStats = await db
                .select({
                    totalOrders: metricExpressions.totalOrderCount,
                    totalAmountCents: metricExpressions.revenue,
                    totalRefunds: metricExpressions.totalRefundAmount,
                })
                .from(orders)
                .innerJoin(branches, eq(orders.branchId, branches.id))
                .leftJoin(groups, eq(branches.groupId, groups.id))
                .where(and(
                    REVENUE_ELIGIBLE_FILTER,
                    orgId ? eq(branches.organizationId, orgId) : undefined,
                    parsedGroupIds.length > 0 ? sql`${groups.id} IN (${sql.join(parsedGroupIds, sql`, `)})` : undefined,
                    parsedBranchIds.length > 0 ? sql`${branches.id} IN (${sql.join(parsedBranchIds, sql`, `)})` : undefined,
                    (() => {
                        const compCond: any[] = []
                        if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) {
                            if (parsedCompMonths.length > 0) compCond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
                            if (parsedCompYears.length > 0) compCond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
                        } else {
                            compCond.push(gte(orders.createdAt, prevStart), lte(orders.createdAt, prevEnd))
                        }
                        return and(...compCond)
                    })()
                ))

            const compSummary = compStats[0]
            comparisonSummary = {
                totalOrders: compSummary?.totalOrders || 0,
                totalRevenue: compSummary?.totalAmountCents || 0,
                totalRefunds: compSummary?.totalRefunds || 0
            }
        }

        const outSummary = {
            totalGroups,
            totalOrders: totalOrders + totalUngroupedOrders,
            totalRevenue: totalRevenue + totalUngroupedRevenue,
            totalRefunds: totalRefunds,
            avgRevenuePerGroup
        }

        if (summaryOnly) {
            return NextResponse.json({ summary: outSummary, comparison: comparisonSummary })
        }

        return NextResponse.json({
            summary: outSummary,
            comparison: comparisonSummary,
            groups: groupsWithBranches,
            ungroupedBranches: ungroupedStats
        })

    } catch (e: any) {
        console.error("Error in group analytics API:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
