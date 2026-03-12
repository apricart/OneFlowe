import { NextRequest } from "next/server"
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm"
import { requireApiRole, ok, error } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, users, orderItems, branches } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const

// BI Analytics Drill-down API - Robust & Parity Sync
export async function GET(req: NextRequest) {
    const err = await requireApiRole(allowedRoles as any)
    if (err) return err

    const scope = await getRequestScope()
    const role = (scope?.role || "").toUpperCase().replace(/\s+/g, '_')

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")?.toUpperCase() // REVENUE, REJECTED, FULFILLED, ORDERS
    const orgIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")
    const branchIdsParam = searchParams.get("branchIds")
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const refundType = searchParams.get("refundType")?.toLowerCase() // all, full, partial
    const sortBy = searchParams.get("sortBy")?.toLowerCase() === "value" ? "value" : "date"
    if (!type || !["REVENUE", "REJECTED", "FULFILLED", "ORDERS", "REFUNDED"].includes(type)) {
        return error("Invalid or missing drill-down type")
    }

    let organizationId: number | null = null
    let branchId: number | null = null
    let branchIds: number[] = []

    if (role === "BRANCH_ADMIN") {
        organizationId = scope?.organizationId ?? null
        branchId = scope?.branchId ?? null
    } else if (role === "HEAD_OFFICE") {
        organizationId = scope?.organizationId ?? null
        if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
            branchId = Number(branchIdParam)
        }
    } else {
        if (orgIdParam && orgIdParam !== "null" && orgIdParam !== "0" && orgIdParam !== "undefined") {
            organizationId = Number(orgIdParam)
        }
        if (branchIdParam && branchIdParam !== "null" && branchIdParam !== "0") {
            branchId = Number(branchIdParam)
        }
    }

    if (branchIdsParam) {
        branchIds = branchIdsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0)
    }

    const conditions: any[] = []

    if (organizationId) conditions.push(eq(orders.organizationId, organizationId))
    if (branchIds.length > 0) {
        conditions.push(inArray(orders.branchId, branchIds))
    } else if (branchId) {
        conditions.push(eq(orders.branchId, branchId))
    }

    if (startDateParam) {
        const start = new Date(startDateParam)
        start.setHours(0, 0, 0, 0)
        conditions.push(gte(orders.createdAt, start))
    }
    if (endDateParam) {
        const end = new Date(endDateParam)
        end.setHours(23, 59, 59, 999)
        conditions.push(lte(orders.createdAt, end))
    }

    // Apply type-specific filters
    if (type === "REVENUE" || type === "FULFILLED") {
        conditions.push(sql`UPPER(${orders.status}) = 'FULFILLED'`)
    } else if (type === "REJECTED") {
        conditions.push(sql`UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED')`)
    } else if (type === "ORDERS") {
        conditions.push(sql`UPPER(${orders.status}) IN ('PENDING', 'APPROVED', 'FULFILLED', 'REFUNDED', 'REJECTED', 'CANCELLED')`)
    } else if (type === "REFUNDED") {
        if (refundType === "full") {
            conditions.push(sql`(${orders.refundAmountCents} >= ${orders.totalCents} AND ${orders.refundAmountCents} > 0)`)
        } else if (refundType === "partial") {
            conditions.push(sql`(${orders.refundAmountCents} < ${orders.totalCents} AND ${orders.refundAmountCents} > 0)`)
        } else {
            conditions.push(sql`(UPPER(${orders.status}) = 'REFUNDED' OR ${orders.refundAmountCents} > 0)`)
        }
    }

    try {
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined

        // BI aggregates and raw data
        const rawData = await db.select({
            id: orders.id,
            tid: orders.tid,
            status: orders.status,
            totalCents: orders.totalCents,
            subtotalCents: orders.subtotalCents,
            taxCents: orders.taxCents,
            refundAmountCents: orders.refundAmountCents,
            createdAt: orders.createdAt,
            fulfilledAt: orders.fulfilledAt,
            branchId: orders.branchId,
            branchName: branches.name,
            receiptData: orders.receiptData,
        })
            .from(orders)
            .leftJoin(branches, eq(orders.branchId, branches.id))
            .where(whereClause)
            .orderBy(sortBy === "value" ? desc(orders.totalCents) : desc(orders.createdAt))
            .limit(1000) // Increase limit for aggregation accuracy

        // Fetch order item counts in bulk
        const orderIds = rawData.map(o => o.id)
        let itemCounts: Record<number, number> = {}
        if (orderIds.length > 0) {
            const counts = await db.select({
                orderId: orderItems.orderId,
                count: sql<number>`count(${orderItems.id})`
            })
                .from(orderItems)
                .where(inArray(orderItems.orderId, orderIds))
                .groupBy(orderItems.orderId)

            itemCounts = counts.reduce((acc, curr) => {
                if (curr.orderId) acc[curr.orderId] = Number(curr.count)
                return acc
            }, {} as Record<number, number>)
        }

        // BI Calculation
        let grossTotal = 0
        let refundTotal = 0
        let rejectedTotal = 0
        let discountTotal = 0
        let totalProcessingSeconds = 0
        let processingCount = 0
        const branchStats: Record<number, { name: string, total: number, refunds: number, count: number }> = {}
        const hourlyDistribution: Record<number, number> = {}

        let totalItems = 0
        rawData.forEach(order => {
            totalItems += (itemCounts[order.id] || 0)
            const total = (order.totalCents || 0) / 100
            const refund = (order.refundAmountCents || 0) / 100
            const status = (order.status || "").toUpperCase()
            const disc = (order.receiptData?.discount || 0)

            // For summary cards, we use the values from the filtered set
            grossTotal += total
            refundTotal += refund
            if (status === "REJECTED" || status === "CANCELLED") {
                rejectedTotal += total
            }

            discountTotal += disc

            // Peak Period
            if (order.createdAt) {
                const hour = new Date(order.createdAt).getHours()
                hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + total
            }

            // Efficiency
            if (order.createdAt && order.fulfilledAt) {
                const start = new Date(order.createdAt).getTime()
                const end = new Date(order.fulfilledAt).getTime()
                if (end >= start) {
                    const diffSeconds = Math.round((end - start) / 1000)
                    totalProcessingSeconds += diffSeconds
                    processingCount++
                }
            }

            // Branch Ranking
            if (order.branchId) {
                if (!branchStats[order.branchId]) {
                    branchStats[order.branchId] = { name: order.branchName || "Unknown", total: 0, refunds: 0, count: 0 }
                }
                const b = branchStats[order.branchId]
                b.count++
                if (status === "FULFILLED" || status === "REFUNDED") {
                    b.total += total
                    if (status === "REFUNDED") b.refunds += refund
                }
            }
        })

        // Formatting Summary
        const sortedHours = Object.entries(hourlyDistribution).sort((a, b) => b[1] - a[1])
        const peakHourRange = sortedHours.length > 0 ? `${sortedHours[0][0]}:00 - ${Number(sortedHours[0][0]) + 1}:00` : "N/A"

        const sortedBranches = Object.entries(branchStats).map(([id, s]) => ({ id, ...s }))
        const topBranch = sortedBranches.sort((a, b) => b.total - a.total)[0]?.name || "N/A"
        const problematicBranch = sortedBranches.sort((a, b) => (b.refunds / (b.total || 1)) - (a.refunds / (a.total || 1)))[0]?.name || "N/A"

        const summary = {
            grossRevenue: grossTotal,
            netRevenue: grossTotal - refundTotal,
            refundRate: grossTotal > 0 ? (refundTotal / grossTotal) * 100 : 0,
            leakage: rejectedTotal + discountTotal,
            discountImpact: discountTotal,
            avgProcessingTime: processingCount > 0 ? Math.round(totalProcessingSeconds / processingCount / 60) : 0,
            totalItems,
            peakPeriod: peakHourRange,
            topBranch,
            problematicBranch
        }

        // Format data and return actual requested UI fields
        const formattedData = rawData.slice(0, 100).map(order => {
            const gross = (order.totalCents || 0) / 100
            const refund = (order.refundAmountCents || 0) / 100
            const status = (order.status || "").toUpperCase()
            const netValue = (gross - refund)

            const created = new Date(order.createdAt!)
            const fulfilled = order.fulfilledAt ? new Date(order.fulfilledAt) : null

            let prepTimeStr = "N/A"
            if (created && fulfilled) {
                const diffMins = Math.round((fulfilled.getTime() - created.getTime()) / 60000)
                prepTimeStr = `${diffMins} mins`
            }

            return {
                id: order.id,
                tid: order.tid,
                status: order.status,
                date: order.createdAt,
                branchName: order.branchName,
                netValue,
                grossValue: gross,
                refundAmount: refund,
                skuCount: itemCounts[order.id] || 0,
                customerLevel: (order.id % 5 === 0) ? "VIP" : "Regular", // Pseudo logic for demo
                preparationTime: prepTimeStr
            }
        })

        // COMPARISON LOGIC
        let comparisonSummary = null
        if (searchParams.get("compare") === "true" && startDateParam && endDateParam) {
            const start = new Date(startDateParam)
            const end = new Date(endDateParam)
            const duration = end.getTime() - start.getTime()
            const prevStart = new Date(start.getTime() - duration - 1)
            const prevEnd = new Date(start.getTime() - 1)

            // Correctly filter out createdAt conditions by rebuilding them
            const compConditions: any[] = []
            if (organizationId) compConditions.push(eq(orders.organizationId, organizationId))
            if (branchIds.length > 0) {
                compConditions.push(inArray(orders.branchId, branchIds))
            } else if (branchId) {
                compConditions.push(eq(orders.branchId, branchId))
            }

            compConditions.push(gte(orders.createdAt, prevStart))
            compConditions.push(lte(orders.createdAt, prevEnd))

            // Re-apply type-specific filters
            if (type === "REVENUE" || type === "FULFILLED") {
                compConditions.push(sql`UPPER(${orders.status}) = 'FULFILLED'`)
            } else if (type === "REJECTED") {
                compConditions.push(sql`UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED')`)
            } else if (type === "ORDERS") {
                compConditions.push(sql`UPPER(${orders.status}) IN ('PENDING', 'APPROVED', 'FULFILLED', 'REFUNDED', 'REJECTED', 'CANCELLED')`)
            } else if (type === "REFUNDED") {
                if (refundType === "full") {
                    compConditions.push(sql`(${orders.refundAmountCents} >= ${orders.totalCents} AND ${orders.refundAmountCents} > 0)`)
                } else if (refundType === "partial") {
                    compConditions.push(sql`(${orders.refundAmountCents} < ${orders.totalCents} AND ${orders.refundAmountCents} > 0)`)
                } else {
                    compConditions.push(sql`(UPPER(${orders.status}) = 'REFUNDED' OR ${orders.refundAmountCents} > 0)`)
                }
            }

            const compWhere = and(...compConditions)
            const compData = await db.select({
                id: orders.id,
                status: orders.status,
                totalCents: orders.totalCents,
                refundAmountCents: orders.refundAmountCents,
                createdAt: orders.createdAt,
                fulfilledAt: orders.fulfilledAt,
                receiptData: orders.receiptData,
            })
                .from(orders)
                .where(compWhere)

            const compOrderIds = compData.map(o => o.id)
            let compItemCount = 0
            if (compOrderIds.length > 0) {
                const countsArr = await db.select({
                    val: sql<number>`count(${orderItems.id})`
                })
                    .from(orderItems)
                    .where(inArray(orderItems.orderId, compOrderIds))
                compItemCount = Number(countsArr[0]?.val || 0)
            }

            let compGross = 0; let compRefund = 0; let compRejected = 0; let compDisc = 0
            compData.forEach(o => {
                const g = (o.totalCents || 0) / 100
                const r = (o.refundAmountCents || 0) / 100
                const s = (o.status || "").toUpperCase()
                if (s === "FULFILLED" || s === "REFUNDED") { compGross += g; if (s === "REFUNDED") compRefund += r }
                else if (s === "REJECTED" || s === "CANCELLED") compRejected += g
                compDisc += (o.receiptData?.discount || 0)
            })

            comparisonSummary = {
                grossRevenue: compGross,
                netRevenue: compGross - compRefund,
                totalItems: compItemCount,
                totalOrders: compData.length,
                leakage: compRejected + compDisc
            }
        }

        return ok({ items: formattedData, summary, comparison: comparisonSummary, total: rawData.length })
    } catch (e) {
        console.error("[DrillDown] Error:", e)
        return error("Internal BI processing error")
    }
}
