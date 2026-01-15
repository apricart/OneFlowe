import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { refunds, orders, branches, users } from "@/db/schema"
import { and, desc, eq, gte, lte, sql } from "drizzle-orm"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const userId = (session.user as any).id
        const userRole = (session.user as any).role
        const role = userRole ? userRole.toUpperCase() : ""

        const url = new URL(req.url)
        const startDate = url.searchParams.get("startDate")
        const endDate = url.searchParams.get("endDate")
        const branchIdParam = url.searchParams.get("branchId")
        const organizationIdParam = url.searchParams.get("organizationId")

        // Get user context for strict RBAC
        const [currentUser] = await db.select({
            organizationId: users.organizationId,
            branchId: users.branchId
        }).from(users).where(eq(users.id, userId)).limit(1)

        const conditions = []

        // 1. Role-Based Access Control
        if (role === "SUPER_ADMIN") {
            if (organizationIdParam && organizationIdParam !== "all") {
                conditions.push(eq(refunds.organizationId, Number(organizationIdParam)))
            }
            if (branchIdParam && branchIdParam !== "all") {
                conditions.push(eq(orders.branchId, Number(branchIdParam)))
            }
        } else if (role === "HEAD_OFFICE") {
            const orgId = currentUser?.organizationId
            if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

            conditions.push(eq(refunds.organizationId, orgId))

            if (branchIdParam && branchIdParam !== "all") {
                conditions.push(eq(orders.branchId, Number(branchIdParam)))
            }
        } else if (role === "BRANCH_ADMIN" || role === "BRANCH_MANAGER") {
            const bId = currentUser?.branchId
            if (!bId) return NextResponse.json({ error: "Branch not assigned" }, { status: 403 })
            conditions.push(eq(orders.branchId, bId))
        } else {
            // Regular users only see their own requested/processed refunds? 
            // For report purposes, likely only admins have access, but let's be safe.
            conditions.push(eq(refunds.requestedByUserId, userId))
        }

        // 2. Date Filtering
        if (startDate) {
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            conditions.push(gte(refunds.createdAt, start))
        }
        if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            conditions.push(lte(refunds.createdAt, end))
        }

        // 3. Execution with Joins
        const data = await db
            .select({
                id: refunds.id,
                orderId: refunds.orderId,
                tid: orders.tid,
                branchName: branches.name,
                branchId: orders.branchId,
                orderDate: orders.createdAt,
                orderTotal: orders.totalCents,
                orderSubtotal: orders.subtotalCents,
                orderTax: orders.taxCents,
                refundAmount: refunds.amountCents,
                reason: refunds.reason,
                status: refunds.status,
                createdAt: refunds.createdAt
            })
            .from(refunds)
            .innerJoin(orders, eq(refunds.orderId, orders.id))
            .innerJoin(branches, eq(orders.branchId, branches.id))
            .where(and(...conditions))
            .orderBy(desc(refunds.createdAt))

        return NextResponse.json({ items: data })
    } catch (error: any) {
        console.error("Refund Report API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
