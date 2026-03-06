import { NextRequest } from "next/server"
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm"
import { requireApiRole, ok, error } from "@/lib/api"
import { db } from "@/lib/db"
import { orders, users, orderItems } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"

const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"] as const

export async function GET(req: NextRequest) {
    const err = await requireApiRole(allowedRoles as any)
    if (err) return err

    const scope = await getRequestScope()
    const role = scope?.role

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")?.toUpperCase() // REVENUE, REJECTED, FULFILLED, ORDERS
    const orgIdParam = searchParams.get("organizationId")
    const branchIdParam = searchParams.get("branchId")
    const branchIdsParam = searchParams.get("branchIds")
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

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
    if (type === "REVENUE") {
        conditions.push(sql`UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED')`)
    } else if (type === "REJECTED") {
        conditions.push(sql`UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED')`)
    } else if (type === "FULFILLED") {
        conditions.push(sql`UPPER(${orders.status}) = 'FULFILLED'`)
    } else if (type === "ORDERS") {
        // all orders including rejected/cancelled for volume analysis
        conditions.push(sql`UPPER(${orders.status}) IN ('PENDING', 'APPROVED', 'FULFILLED', 'REFUNDED', 'REJECTED', 'CANCELLED')`)
    } else if (type === "REFUNDED") {
        conditions.push(sql`UPPER(${orders.status}) = 'REFUNDED' OR ${orders.refundAmountCents} > 0`)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // For performance, we limit drill-down records to last 100
    const rawData = await db.select({
        id: orders.id,
        tid: orders.tid,
        status: orders.status,
        totalCents: orders.totalCents,
        taxCents: orders.taxCents,
        subtotalCents: orders.subtotalCents,
        refundAmountCents: orders.refundAmountCents,
        createdAt: orders.createdAt,
        fulfilledAt: orders.fulfilledAt,
        rejectionReason: orders.rejectionReason,
        rejectedAt: orders.rejectedAt,
        // user relations
        creatorName: users.fullName,
        creatorEmail: users.email,
        creatorId: users.id,
    })
        .from(orders)
        .leftJoin(users, eq(orders.createdByUserId, users.id))
        .where(whereClause)
        .orderBy(desc(orders.createdAt))
        .limit(100)

    // Format data and mock requested UI fields intelligently
    const formattedData = rawData.map(order => {
        const gross = (order.totalCents || 0) / 100
        const refund = (order.refundAmountCents || 0) / 100
        const netValue = type === "REVENUE" ? gross - refund : gross

        const created = new Date(order.createdAt!)
        const rejected = order.rejectedAt ? new Date(order.rejectedAt) : null
        const fulfilled = order.fulfilledAt ? new Date(order.fulfilledAt) : null

        let prepTimeStr = "N/A"
        if (created && fulfilled) {
            const diffMins = Math.round((fulfilled.getTime() - created.getTime()) / 60000)
            prepTimeStr = `${diffMins} mins`
        }

        let rejectedTimeElapsedStr = "N/A"
        if (created && rejected) {
            const diffMins = Math.round((rejected.getTime() - created.getTime()) / 60000)
            rejectedTimeElapsedStr = `${diffMins} mins`
        }

        // --- Mocking logic for impressive UI demo ---
        const paymentMethods = ["Credit Card", "Cash on Delivery", "Bank Transfer", "Wallet"]
        const mockPaymentMethod = paymentMethods[order.id % paymentMethods.length]

        const terminals = ["POS-Main", "Kiosk-01", "Web-Gateway", "Mobile-App"]
        const mockTerminal = terminals[order.id % terminals.length]

        const sources = ["Web", "Mobile App", "In-Store", "Partner"]
        const channels = ["Organic", "Direct", "Social", "Paid"]
        const loyalties = ["Gold", "Silver", "Guest", "Platinum"]

        return {
            id: order.id,
            tid: order.tid,
            status: order.status,
            date: order.createdAt,
            // Revenue specific
            netValue,
            subtotalAmount: (order.subtotalCents || 0) / 100,
            taxAmount: (order.taxCents || 0) / 100,
            paymentMethod: mockPaymentMethod,
            customerName: order.creatorName || order.creatorEmail || "Guest User",
            discount: 0, // Mocked to 0 for now
            // Rejected specific
            rejectionReason: order.rejectionReason || "Out of stock item",
            rejectedBy: `Manager (${order.creatorId?.substring(0, 6) || "SYS"})`,
            timeElapsed: rejectedTimeElapsedStr,
            timeOfRejection: order.rejectedAt,
            // Fulfilled specific
            preparationTime: prepTimeStr,
            completionTime: order.fulfilledAt,
            terminalId: mockTerminal,
            assignedStaff: `Staff-${(order.id % 5) + 1}`,
            skuCount: Math.floor((order.totalCents || 0) / 2500) + 1, // Mocked based on size
            // Orders specific
            source: sources[order.id % sources.length],
            channel: channels[order.id % channels.length],
            loyaltyStatus: loyalties[order.id % loyalties.length],
        }
    })

    return ok({ items: formattedData, total: formattedData.length })
}
