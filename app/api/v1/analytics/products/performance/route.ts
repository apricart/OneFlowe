import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, orderItems, branches, globalProducts, categories, refundItems, refunds } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc, isNull, sql } from "drizzle-orm"
import { aliasedTable } from "drizzle-orm"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const userRole = ((session.user as any).role || "").toUpperCase().replace(/\s+/g, '_')
        const userOrgId = (session.user as any).organizationId
        const userBranchId = (session.user as any).branchId

        const url = new URL(req.url)
        const startDateParam = url.searchParams.get("startDate")
        const endDateParam = url.searchParams.get("endDate")
        const branchIdsParam = url.searchParams.get("branchIds")
        const compare = url.searchParams.get("compare") === "true"
        const compareStartDateParam = url.searchParams.get("compareStartDate")
        const compareEndDateParam = url.searchParams.get("compareEndDate")

        const monthsRaw = url.searchParams.get("months")
        const yearsRaw = url.searchParams.get("years")
        const compareMonthsRaw = url.searchParams.get("compareMonths")
        const compareYearsRaw = url.searchParams.get("compareYears")

        const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
        const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []
        const parsedCompMonths = compareMonthsRaw ? compareMonthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
        const parsedCompYears = compareYearsRaw ? compareYearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []

        // RBAC Context Parsing
        let branchIds: number[] = []
        if (branchIdsParam) {
            branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        } else if (userRole === "BRANCH_ADMIN" || userRole === "BRANCH_MANAGER" || userRole === "ORDER_PORTAL") {
            branchIds = [userBranchId]
        } else {
            const b = await db.select({ id: branches.id }).from(branches).where(userOrgId ? eq(branches.organizationId, userOrgId) : undefined)
            branchIds = b.map(br => br.id)
        }

        if (branchIds.length === 0) {
            return NextResponse.json({ error: "No branches resolved" }, { status: 400 })
        }

        let startDate = startDateParam ? new Date(startDateParam) : undefined
        let endDate = endDateParam ? new Date(endDateParam) : undefined
        if (startDate) startDate.setHours(0, 0, 0, 0)
        if (endDate) endDate.setHours(23, 59, 59, 999)

        const baseConditions: any[] = [
            inArray(orders.branchId, branchIds),
            sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')`
        ]

        if (parsedMonths.length > 0) {
            baseConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
        }
        if (parsedYears.length > 0) {
            baseConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
        }

        if (parsedMonths.length === 0 && parsedYears.length === 0) {
            if (startDate) baseConditions.push(gte(orders.createdAt, startDate))
            if (endDate) baseConditions.push(lte(orders.createdAt, endDate))
        }

        // Find all order items matching filters
        const q = db
            .select({
                orderId: orders.id,
                status: orders.status,
                globalProductId: orderItems.globalProductId,
                itemCode: globalProducts.productCode,
                itemName: globalProducts.name,
                itemUnit: globalProducts.unit,
                categoryName: categories.name,
                qtyOrdered: orderItems.quantity,
                priceCents: orderItems.priceCents,
                orderItemId: orderItems.id
            })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .innerJoin(globalProducts, eq(orderItems.globalProductId, globalProducts.id))
            .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
            .where(and(...baseConditions))

        const results = await q

        // Get refund data for calculating exact refunded quantities
        const validOrderItemIds = results.map(r => r.orderItemId)
        let refundQuantities: Record<number, number> = {}

        if (validOrderItemIds.length > 0) {
            const refundsObj = await db
                .select({
                    orderItemId: refundItems.orderItemId,
                    qty: refundItems.quantity,
                })
                .from(refundItems)
                .innerJoin(refunds, eq(refundItems.refundId, refunds.id))
                .where(and(
                    inArray(refundItems.orderItemId, validOrderItemIds),
                    inArray(sql`UPPER(${refunds.status})`, ['APPROVED', 'COMPLETED'])
                ))

            refundQuantities = refundsObj.reduce((acc, curr) => {
                if (curr.orderItemId) {
                    acc[curr.orderItemId] = (acc[curr.orderItemId] || 0) + curr.qty
                }
                return acc
            }, {} as Record<number, number>)
        }

        // 1. Fetch ALL active/inactive global products to serve as the baseline map
        const parentCategories = aliasedTable(categories, 'parentCategories')
        
        const allProducts = await db
            .select({
                id: globalProducts.id,
                productCode: globalProducts.productCode,
                name: globalProducts.name,
                unit: globalProducts.unit,
                status: globalProducts.status,
                categoryName: sql<string>`COALESCE(${parentCategories.name}, ${categories.name})`,
                subCategoryName: sql<string>`CASE WHEN ${parentCategories.id} IS NOT NULL THEN ${categories.name} ELSE NULL END`
            })
            .from(globalProducts)
            .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
            .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
            .where(isNull(globalProducts.deletedAt)) // Exclude deleted products
            
        // 2. Initialize the product map with ALL products
        const productMap: Record<number, any> = {}
        allProducts.forEach(p => {
            productMap[p.id] = {
                productId: p.id,
                productCode: p.productCode || 'Unknown',
                productName: p.name,
                unit: p.unit,
                category: p.categoryName || 'Uncategorized',
                subCategory: p.subCategoryName || '-',
                status: p.status, // Add exact status exactly for matching Global Products
                totalOrders: new Set(),
                qtyOrdered: 0,
                qtyFulfilled: 0,
                qtyRefunded: 0,
                revenueGeneratedCents: 0,
                refundLossCents: 0
            }
        })

        // 3. Aggregate order data onto the product map
        results.forEach(row => {
            if (productMap[row.globalProductId]) {
                const pInfo = productMap[row.globalProductId]
                pInfo.totalOrders.add(row.orderId)
                pInfo.qtyOrdered += row.qtyOrdered

                // Determine Fulfilled vs Refunded universally for recognized statuses
                const s = (row.status || "").toUpperCase()
                if (s === 'FULFILLED' || s === 'REFUNDED' || s === 'APPROVED' || s === 'PARTIAL' || s === 'PARTIALLY_FULFILLED') {
                    const refundedCount = refundQuantities[row.orderItemId] || 0
                    const fulfilledCount = Math.max(0, row.qtyOrdered - refundedCount)

                    pInfo.qtyRefunded += refundedCount
                    pInfo.qtyFulfilled += fulfilledCount

                    pInfo.revenueGeneratedCents += (fulfilledCount * row.priceCents)
                    pInfo.refundLossCents += (refundedCount * row.priceCents)
                }
            }
        })

        // Format mapping back to array and sort
        const aggregated = Object.values(productMap).map(p => ({
            ...p,
            totalOrders: p.totalOrders.size // convert set -> size
        }))
        // Sort by revenue DESC, then by product name ASC
        aggregated.sort((a, b) => {
            if (b.revenueGeneratedCents === a.revenueGeneratedCents) {
                return (a.productName || "").localeCompare(b.productName || "")
            }
            return b.revenueGeneratedCents - a.revenueGeneratedCents
        })

        // COMPARISON logic for overall KPIs
        let comparisonSummary = null
        if (compare && startDateParam && endDateParam) {
            let prevStart: Date
            let prevEnd: Date
            
            if (compareStartDateParam && compareEndDateParam) {
                prevStart = new Date(compareStartDateParam)
                prevEnd = new Date(compareEndDateParam)
                prevStart.setHours(0, 0, 0, 0)
                prevEnd.setHours(23, 59, 59, 999)
            } else {
                const start = new Date(startDateParam)
                const end = new Date(endDateParam)
                const duration = end.getTime() - start.getTime()
                prevStart = new Date(start.getTime() - duration - 1)
                prevEnd = new Date(start.getTime() - 1)
            }

            const compResults = await db
                .select({
                    globalProductId: orderItems.globalProductId,
                    status: orders.status,
                    qtyOrdered: orderItems.quantity,
                    priceCents: orderItems.priceCents,
                    orderItemId: orderItems.id
                })
                .from(orderItems)
                .innerJoin(orders, eq(orderItems.orderId, orders.id))
                .where(
                    and(
                        inArray(orders.branchId, branchIds),
                        sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')`,
                        (() => {
                            const compCond: any[] = []
                            if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) {
                                if (parsedCompMonths.length > 0) compCond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
                                if (parsedCompYears.length > 0) compCond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
                            } else {
                                if (prevStart) compCond.push(gte(orders.createdAt, prevStart))
                                if (prevEnd) compCond.push(lte(orders.createdAt, prevEnd))
                            }
                            return and(...compCond)
                        })()
                    )
                )

            const compOrderItemIds = compResults.map(r => r.orderItemId)
            let compRefundQuantities: Record<number, number> = {}
            if (compOrderItemIds.length > 0) {
                const compRefunds = await db
                    .select({ orderItemId: refundItems.orderItemId, qty: refundItems.quantity })
                    .from(refundItems)
                    .where(inArray(refundItems.orderItemId, compOrderItemIds))

                compRefundQuantities = compRefunds.reduce((acc, curr) => {
                    if (curr.orderItemId) acc[curr.orderItemId] = (acc[curr.orderItemId] || 0) + curr.qty
                    return acc
                }, {} as Record<number, number>)
            }

            let compRev = 0, compVol = 0, compRef = 0
            compResults.forEach(r => {
                const s = (r.status || "").toUpperCase()
                if (s === 'FULFILLED' || s === 'APPROVED' || s === 'PARTIAL' || s === 'PARTIALLY_FULFILLED') {
                    const refQ = compRefundQuantities[r.orderItemId] || 0
                    compRef += refQ
                    const fulfilledCount = Math.max(0, r.qtyOrdered - refQ)
                    compVol += fulfilledCount
                    compRev += (fulfilledCount * r.priceCents)
                } else if (s === 'REFUNDED') {
                    const refQ = compRefundQuantities[r.orderItemId] || 0
                    compRef += refQ
                    compVol += Math.max(0, r.qtyOrdered - refQ)
                    compRev += (Math.max(0, r.qtyOrdered - refQ) * r.priceCents)
                }
            })

            comparisonSummary = {
                totalRevenue: compRev,
                totalVolume: compVol,
                totalRefunds: compRef,
                uniqueSKUs: new Set(compResults.map(r => (r as any).globalProductId)).size
            }

            // Product-level comparison map
            const compProductMap: Record<number, any> = {}
            compResults.forEach(row => {
                const gpid = (row as any).globalProductId
                if (!gpid) return
                if (!compProductMap[gpid]) {
                    compProductMap[gpid] = { qtyFulfilled: 0, revenueGeneratedCents: 0 }
                }
                const pInfo = compProductMap[gpid]
                const s = (row.status || "").toUpperCase()
                if (s === 'FULFILLED' || s === 'APPROVED' || s === 'PARTIAL' || s === 'PARTIALLY_FULFILLED') {
                    const refQ = compRefundQuantities[row.orderItemId] || 0
                    const fulfilledCount = Math.max(0, row.qtyOrdered - refQ)
                    pInfo.qtyFulfilled += fulfilledCount
                    pInfo.revenueGeneratedCents += (fulfilledCount * row.priceCents)
                } else if (s === 'REFUNDED') {
                    const refQ = compRefundQuantities[row.orderItemId] || 0
                    const fulfilledCount = Math.max(0, row.qtyOrdered - refQ)
                    pInfo.qtyFulfilled += fulfilledCount
                    pInfo.revenueGeneratedCents += (fulfilledCount * row.priceCents)
                }
            })

            // Attach comparison data to aggregated results
            aggregated.forEach((p: any) => {
                const comp = compProductMap[p.productId]
                if (comp) {
                    p.compareQty = comp.qtyFulfilled
                    p.compareRevenue = comp.revenueGeneratedCents
                } else {
                    p.compareQty = 0
                    p.compareRevenue = 0
                }
            })
        }

        return NextResponse.json({
            data: aggregated,
            comparison: comparisonSummary
        })
    } catch (error: any) {
        console.error("Products Performance Request failed: ", error)
        return NextResponse.json({ error: "Failed to fetch product performance" }, { status: 500 })
    }
}
