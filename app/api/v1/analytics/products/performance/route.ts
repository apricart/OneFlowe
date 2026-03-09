import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, orderItems, branches, globalProducts, categories, refundItems } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc } from "drizzle-orm"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const userRole = ((session.user as any).role || "").toUpperCase()
        const userOrgId = (session.user as any).organizationId
        const userBranchId = (session.user as any).branchId

        const url = new URL(req.url)
        const startDateParam = url.searchParams.get("startDate")
        const endDateParam = url.searchParams.get("endDate")
        const branchIdsParam = url.searchParams.get("branchIds")

        // RBAC Context Parsing
        let branchIds: number[] = []
        if (branchIdsParam) {
            branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id))
        } else if (userRole === "BRANCH_ADMIN" || userRole === "BRANCH_MANAGER" || userRole === "ORDER_PORTAL") {
            branchIds = [userBranchId]
        } else {
            const b = await db.select({ id: branches.id }).from(branches).where(userOrgId ? eq(branches.organizationId, userOrgId) : undefined)
            branchIds = b.map(br => br.id)
        }

        if (branchIds.length === 0) {
            return NextResponse.json({ error: "No branches resolved" }, { status: 400 })
        }

        let startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        let endDate = endDateParam ? new Date(endDateParam) : new Date()
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)

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
            .where(
                and(
                    inArray(orders.branchId, branchIds),
                    gte(orders.createdAt, startDate),
                    lte(orders.createdAt, endDate),
                    inArray(orders.status, ['FULFILLED', 'APPROVED', 'REFUNDED'])
                )
            )

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
                .where(inArray(refundItems.orderItemId, validOrderItemIds))

            refundQuantities = refundsObj.reduce((acc, curr) => {
                if (curr.orderItemId) {
                    acc[curr.orderItemId] = (acc[curr.orderItemId] || 0) + curr.qty
                }
                return acc
            }, {} as Record<number, number>)
        }

        // Aggregate by Global Product ID
        const productMap: Record<number, any> = {}

        results.forEach(row => {
            if (!productMap[row.globalProductId]) {
                productMap[row.globalProductId] = {
                    productId: row.globalProductId,
                    productCode: row.itemCode || 'Unknown',
                    productName: row.itemName,
                    unit: row.itemUnit,
                    category: row.categoryName || 'Uncategorized',
                    totalOrders: new Set(),
                    qtyOrdered: 0,
                    qtyFulfilled: 0,
                    qtyRefunded: 0,
                    revenueGeneratedCents: 0,
                    refundLossCents: 0
                }
            }

            const pInfo = productMap[row.globalProductId]
            pInfo.totalOrders.add(row.orderId)
            pInfo.qtyOrdered += row.qtyOrdered

            // Determine Fulfilled vs Refunded
            if (row.status === 'FULFILLED' || row.status === 'APPROVED') {
                pInfo.qtyFulfilled += row.qtyOrdered
                pInfo.revenueGeneratedCents += (row.qtyOrdered * row.priceCents)
            } else if (row.status === 'REFUNDED') {
                const refundedCount = refundQuantities[row.orderItemId] || 0
                const fulfilledCount = Math.max(0, row.qtyOrdered - refundedCount)

                pInfo.qtyRefunded += refundedCount
                pInfo.qtyFulfilled += fulfilledCount

                pInfo.revenueGeneratedCents += (fulfilledCount * row.priceCents)
                pInfo.refundLossCents += (refundedCount * row.priceCents)
            }
        })

        // Format mapping back to array
        const aggregated = Object.values(productMap).map(p => ({
            ...p,
            totalOrders: p.totalOrders.size // convert set -> size
        })).sort((a, b) => b.revenueGeneratedCents - a.revenueGeneratedCents) // sort by revenue desc

        return NextResponse.json({ data: aggregated })
    } catch (error: any) {
        console.error("Products Performance Request failed: ", error)
        return NextResponse.json({ error: "Failed to fetch product performance" }, { status: 500 })
    }
}
