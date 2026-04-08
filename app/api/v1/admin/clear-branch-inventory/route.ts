import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin } from "@/lib/db"
import { branchInventory, auditLogs } from "@/db/schema"
import { sql, isNull, eq } from "drizzle-orm"

// POST /api/v1/admin/clear-branch-inventory - Clear all legacy branch inventory data
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const user = session.user as any
        if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const result = await withSuperAdmin(async (tx: any) => {
            // Count existing records first
            const [countResult] = await tx.select({ count: sql<number>`cast(count(*) as integer)` })
                .from(branchInventory)
                .where(isNull(branchInventory.deletedAt))

            if (!countResult || countResult.count === 0) {
                return { message: "No records to clear", clearedCount: 0 }
            }

            // Soft-delete all records by setting deletedAt
            const deleted = await tx.update(branchInventory)
                .set({ deletedAt: new Date(), updatedAt: new Date() })
                .where(isNull(branchInventory.deletedAt))
                .returning({ id: branchInventory.id })

            // Log the action
            await tx.insert(auditLogs).values({
                userId: user.id,
                action: "BULK_DELETE",
                entity: "BranchInventory",
                entityId: "ALL",
                metadata: {
                    clearedCount: deleted.length,
                    reason: "Clear legacy data for new branch assignment flow"
                },
            })

            return {
                message: `Successfully cleared ${deleted.length} branch inventory records`,
                clearedCount: deleted.length
            }
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error("Error clearing branch inventory:", error)
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
    }
}

// GET /api/v1/admin/clear-branch-inventory - Check status of branch inventory data
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const user = session.user as any
        if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const result = await withSuperAdmin(async (tx: any) => {
            // Count active (not deleted) records
            const [activeResult] = await tx.select({ count: sql<number>`cast(count(*) as integer)` })
                .from(branchInventory)
                .where(isNull(branchInventory.deletedAt))

            // Count deleted records
            const [deletedResult] = await tx.select({ count: sql<number>`cast(count(*) as integer)` })
                .from(branchInventory)
                .where(sql`${branchInventory.deletedAt} IS NOT NULL`)

            // Get sample of active records
            const samples = await tx.select({
                id: branchInventory.id,
                branchId: branchInventory.branchId,
                organizationId: branchInventory.organizationId,
                isVisible: branchInventory.isVisible,
                isActive: branchInventory.isActive,
                deletedAt: branchInventory.deletedAt
            })
                .from(branchInventory)
                .where(isNull(branchInventory.deletedAt))
                .limit(5)

            return {
                activeCount: activeResult?.count || 0,
                deletedCount: deletedResult?.count || 0,
                samples
            }
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error("Error checking branch inventory:", error)
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
    }
}

