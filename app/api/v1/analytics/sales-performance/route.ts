import { NextRequest } from "next/server"
import { and, eq, gte, lte, sql, or, inArray, desc } from "drizzle-orm"
import { requireApiRole, ok } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, branches, organizations } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"
import { getCached, generateCacheKey, CACHE_TTL } from "@/lib/cache-utils"
import { metricExpressions } from "@/lib/metric-utils"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const
type Role = typeof allowedRoles[number]

export async function GET(req: NextRequest) {
    const err = await requireApiRole(allowedRoles as any)
    if (err) return err

    const scope = await getRequestScope()
    const role = scope?.role as Role | undefined

    const { searchParams } = new URL(req.url)
    const orgIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")
    const branchIdsParam = searchParams.get("branchIds") // comma-separated
    const groupIdParam = searchParams.get("groupId")
    const statusParam = searchParams.get("status") // PENDING | FULFILLED | REFUNDED | all
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const compareStartDateParam = searchParams.get("compareStartDate")
    const compareEndDateParam = searchParams.get("compareEndDate")

    let organizationId: number | null = null
    let branchId: number | null = null
    let groupId: number | null = null
    let branchIds: number[] = []

    // Role-based scoping
    if (role === "BRANCH_ADMIN") {
        organizationId = scope?.organizationId ?? null
        branchId = scope?.branchId ?? null
    } else if (role === "HEAD_OFFICE") {
        organizationId = scope?.organizationId ?? null
        if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
            branchId = Number(branchIdParam)
        }
    } else {
        // SUPER_ADMIN
        if (orgIdParam && orgIdParam !== "null" && orgIdParam !== "0") {
            organizationId = Number(orgIdParam)
        }
        if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
            branchId = Number(branchIdParam)
        }
    }

    if (branchIdsParam) {
        branchIds = branchIdsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0)
    }

    if (groupIdParam && groupIdParam !== "null" && groupIdParam !== "0") {
        groupId = Number(groupIdParam)
    }

    // Date range - default to today
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const startDate = startDateParam ? new Date(startDateParam) : todayStart
    const endDate = endDateParam ? new Date(endDateParam) : todayEnd

    // Determine granularity for series: hourly for 1 day, daily for ≤32 days, monthly for ≤400 days, yearly for more
    const diffMs = endDate.getTime() - startDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    const granularity: "hourly" | "daily" | "monthly" | "yearly" =
        diffDays <= 1 ? "hourly" : diffDays <= 32 ? "daily" : diffDays <= 400 ? "monthly" : "yearly"

    const cacheKey = generateCacheKey("sales-perf", {
        role, organizationId, branchId,
        branchIds: branchIds.join(","),
        groupId, status: statusParam,
        start: startDate.toISOString().slice(0, 16),
        end: endDate.toISOString().slice(0, 16),
        compareStart: compareStartDateParam || "",
        compareEnd: compareEndDateParam || "",
        granularity,
    })

    const fetchData = async () => {
        // Build base conditions
        const conditions: any[] = [
            gte(orders.createdAt, startDate),
            lte(orders.createdAt, endDate),
        ]

        // Status filter: normalize to uppercase for comparison
        const upperStatus = statusParam?.toUpperCase()
        if (upperStatus && upperStatus !== "ALL") {
            if (upperStatus === "REJECTED") {
                conditions.push(or(eq(sql`UPPER(${orders.status})`, "REJECTED"), eq(sql`UPPER(${orders.status})`, "CANCELLED")))
            } else {
                conditions.push(eq(sql`UPPER(${orders.status})`, upperStatus))
            }
        }

        // Scope filters
        if (organizationId) conditions.push(eq(orders.organizationId, organizationId))

        if (branchIds.length > 0) {
            conditions.push(inArray(orders.branchId, branchIds))
        } else if (branchId) {
            conditions.push(eq(orders.branchId, branchId))
        }

        if (groupId) conditions.push(eq(branches.groupId, groupId))

        const whereClause = and(...conditions)

        // ── Series data ──
        let dateExpr: any
        let labelExpr: any

        if (granularity === "hourly") {
            dateExpr = sql`date_trunc('hour', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')`
            labelExpr = sql<string>`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'HH12:MI AM')`
        } else if (granularity === "daily") {
            dateExpr = sql`date_trunc('day', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')`
            labelExpr = sql<string>`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'DD Mon')`
        } else if (granularity === "monthly") {
            dateExpr = sql`date_trunc('month', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')`
            labelExpr = sql<string>`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'Mon YYYY')`
        } else {
            dateExpr = sql`date_trunc('year', (${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')`
            labelExpr = sql<string>`TO_CHAR((${orders.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'YYYY')`
        }

        const seriesRows = await db
            .select({
                bucket: dateExpr,
                label: labelExpr,
                totalSales: metricExpressions.revenue,
                netSales: metricExpressions.revenue,
                orderCount: sql<number>`COALESCE(COUNT(1), 0)`.mapWith(Number),
            })
            .from(orders)
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(whereClause)
            .groupBy(dateExpr, labelExpr)
            .orderBy(dateExpr)

        const seriesData = seriesRows.map(r => ({
            label: r.label,
            sales: (r.totalSales || 0) / 100,
            netSales: (r.netSales || 0) / 100,
            orders: Number(r.orderCount || 0),
        }))

        // ── Aggregates ──
        const totalSales = seriesData.reduce((s, r) => s + r.sales, 0)
        const totalNetSales = seriesData.reduce((s, r) => s + r.netSales, 0)
        const totalOrders = seriesData.reduce((s, r) => s + r.orders, 0)
        const activePeriods = seriesData.filter(r => r.sales > 0)
        const avgSales = activePeriods.length > 0 ? totalSales / activePeriods.length : 0

        const peakPeriod = seriesData.length > 0
            ? seriesData.reduce((max, r) => r.sales > max.sales ? r : max, seriesData[0])
            : null

        // ── Branch breakdown ──
        const branchConditions: any[] = [
            gte(orders.createdAt, startDate),
            lte(orders.createdAt, endDate),
        ]
        if (statusParam && statusParam !== "all") {
            branchConditions.push(sql`UPPER(${orders.status}) = ${statusParam.toUpperCase()}`)
        } else {
            branchConditions.push(
                sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED', 'PENDING', 'REJECTED', 'CANCELLED')`
            )
        }
        if (organizationId) branchConditions.push(eq(orders.organizationId, organizationId))
        if (branchIds.length > 0) {
            branchConditions.push(inArray(orders.branchId, branchIds))
        } else if (branchId) {
            branchConditions.push(eq(orders.branchId, branchId))
        }
        if (groupId) branchConditions.push(eq(branches.groupId, groupId))

        let branchQuery = db
            .select({
                branchId: branches.id,
                branchName: branches.name,
                totalSales: metricExpressions.revenue,
                totalNetSales: metricExpressions.revenue,
                orderCount: sql<number>`COALESCE(COUNT(${orders.id}), 0)`.mapWith(Number),
            })
            .from(branches)
            .leftJoin(orders, and(eq(orders.branchId, branches.id), and(...branchConditions)))

        if (organizationId) {
            branchQuery = branchQuery.where(eq(branches.organizationId, organizationId)) as any
        }

        const branchRows = await branchQuery
            .groupBy(branches.id, branches.name)
            .orderBy(desc(metricExpressions.revenue))
            .limit(20)

        const branchSales = branchRows.map(r => ({
            branchId: r.branchId,
            branchName: r.branchName || "Unnamed",
            sales: (r.totalSales || 0) / 100,
            netSales: (r.totalNetSales || 0) / 100,
            orders: Number(r.orderCount || 0),
        }))

        // ── Organization breakdown (Super Admin only, when no org is selected) ──
        let organizationSales: any[] = []
        if (role === "SUPER_ADMIN" && !organizationId) {
            const orgRows = await db
                .select({
                    organizationId: organizations.id,
                    organizationName: organizations.name,
                    totalSales: metricExpressions.revenue,
                    totalNetSales: metricExpressions.revenue,
                    orderCount: sql<number>`COALESCE(COUNT(${orders.id}), 0)`.mapWith(Number),
                })
                .from(organizations)
                .leftJoin(orders, and(eq(orders.organizationId, organizations.id), whereClause))
                .groupBy(organizations.id, organizations.name)
                .orderBy(desc(metricExpressions.revenue))
                .limit(20)

            organizationSales = orgRows.map(r => ({
                organizationId: r.organizationId,
                organizationName: r.organizationName || "Unnamed",
                sales: (r.totalSales || 0) / 100,
                netSales: (r.totalNetSales || 0) / 100,
                orders: Number(r.orderCount || 0),
            }))
        }

        // ── Comparison Logic ──
        let comparison: any = null
        if (searchParams.get("compare") === "true") {
            let prevStart: Date
            let prevEnd: Date
            
            if (compareStartDateParam && compareEndDateParam) {
                prevStart = new Date(compareStartDateParam)
                prevEnd = new Date(compareEndDateParam)
                prevStart.setHours(0, 0, 0, 0)
                prevEnd.setHours(23, 59, 59, 999)
            } else {
                const start = new Date(startDate)
                const end = new Date(endDate)
                const duration = end.getTime() - start.getTime()
                prevStart = new Date(start.getTime() - duration - 1)
                prevEnd = new Date(start.getTime() - 1)
            }

            const compConditions: any[] = [
                gte(orders.createdAt, prevStart),
                lte(orders.createdAt, prevEnd),
            ]

            if (upperStatus && upperStatus !== "ALL") {
                if (upperStatus === "REJECTED") {
                    compConditions.push(or(eq(sql`UPPER(${orders.status})`, "REJECTED"), eq(sql`UPPER(${orders.status})`, "CANCELLED")))
                } else {
                    compConditions.push(eq(sql`UPPER(${orders.status})`, upperStatus))
                }
            }

            if (organizationId) compConditions.push(eq(orders.organizationId, organizationId))
            if (branchIds.length > 0) {
                compConditions.push(inArray(orders.branchId, branchIds))
            } else if (branchId) {
                compConditions.push(eq(orders.branchId, branchId))
            }
            if (groupId) compConditions.push(eq(branches.groupId, groupId))

            const compWhere = and(...compConditions)

            // Series for comparison
            const compSeriesRows = await db
                .select({
                    bucket: dateExpr,
                    label: labelExpr,
                    totalSales: metricExpressions.revenue,
                    totalNetSales: metricExpressions.revenue,
                    orderCount: sql<number>`COALESCE(COUNT(1), 0)`.mapWith(Number),
                })
                .from(orders)
                .leftJoin(branches, eq(orders.branchId, branches.id))
                .where(compWhere)
                .groupBy(dateExpr, labelExpr)
                .orderBy(dateExpr)

            const compSeriesData = compSeriesRows.map(r => ({
                label: r.label,
                sales: (r.totalSales || 0) / 100,
                netSales: (r.totalNetSales || 0) / 100,
                orders: Number(r.orderCount || 0),
            }))

            const compTotalSales = compSeriesData.reduce((s, r) => s + r.sales, 0)
            const compTotalNetSales = compSeriesData.reduce((s, r) => s + r.netSales, 0)
            const compTotalOrders = compSeriesData.reduce((s, r) => s + r.orders, 0)

            // Aggregated counts for all statuses (for KPI comparison)
            const compAllStatusConditions: any[] = [
                gte(orders.createdAt, prevStart),
                lte(orders.createdAt, prevEnd),
            ]
            if (organizationId) compAllStatusConditions.push(eq(orders.organizationId, organizationId))
            if (branchIds.length > 0) {
                compAllStatusConditions.push(inArray(orders.branchId, branchIds))
            } else if (branchId) {
                compAllStatusConditions.push(eq(orders.branchId, branchId))
            }
            if (groupId) compAllStatusConditions.push(eq(branches.groupId, groupId))

            const compAllWhere = and(...compAllStatusConditions)
            const compStatusCounts = await db.select({
                fulfilledCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END), 0)`.mapWith(Number),
                fulfilledNetSales: metricExpressions.revenue,
                refundedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END), 0)`.mapWith(Number),
                rejectedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END), 0)`.mapWith(Number),
                approvedCount: sql<number>`COALESCE(COUNT(CASE WHEN UPPER(${orders.status}) = 'APPROVED' THEN 1 END), 0)`.mapWith(Number),
            })
                .from(orders)
                .leftJoin(branches, eq(orders.branchId, branches.id))
                .where(compAllWhere)

            comparison = {
                totalSales: compTotalSales,
                totalNetSales: compTotalNetSales,
                totalOrders: compTotalOrders,
                fulfilledCount: compStatusCounts[0]?.fulfilledCount || 0,
                fulfilledNetSales: (compStatusCounts[0]?.fulfilledNetSales || 0) / 100,
                refundedCount: compStatusCounts[0]?.refundedCount || 0,
                rejectedCount: compStatusCounts[0]?.rejectedCount || 0,
                approvedCount: compStatusCounts[0]?.approvedCount || 0,
                seriesData: compSeriesData
            }
        }

        return {
            granularity,
            seriesData,
            totalSales,
            totalNetSales,
            totalOrders,
            avgSales,
            peakPeriod,
            branchSales,
            organizationSales,
            comparison
        }
    }

    const data = await getCached(cacheKey, fetchData, CACHE_TTL.ANALYTICS)
    return ok(data)
}
