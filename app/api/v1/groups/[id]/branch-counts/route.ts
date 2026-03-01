import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { groups, branches, branchInventory } from "@/db/schema"
import { eq, and, isNull, count, sql } from "drizzle-orm"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params
        const { id } = params
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const role = (session.user as any).role
        if (role !== "HEAD_OFFICE" && role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const groupId = parseInt(id)
        if (isNaN(groupId)) {
            return NextResponse.json({ error: "Invalid group ID" }, { status: 400 })
        }

        // 1. Verify group exists and belongs to the user organization (if not super admin)
        const [group] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, groupId))
            .limit(1)

        if (!group) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 })
        }

        const userOrgId = (session.user as any).organizationId
        if (role === "HEAD_OFFICE" && group.organizationId !== userOrgId) {
            return NextResponse.json({ error: "Forbidden: group does not belong to your organization" }, { status: 403 })
        }

        // 2. Aggregate active product assignments per branch in this group via grouping
        // This is safe even with >10000 products as PostgeSQL performs the aggregation internally
        const assignmentsQuery = await db
            .select({
                branchId: branchInventory.branchId,
                productCount: count(branchInventory.id)
            })
            .from(branchInventory)
            .innerJoin(branches, eq(branchInventory.branchId, branches.id))
            .where(
                and(
                    eq(branches.groupId, groupId),
                    isNull(branchInventory.deletedAt),
                    eq(branchInventory.isActive, true)
                )
            )
            .groupBy(branchInventory.branchId)

        // Count unique products assigned globally for this group across all its branches
        // Since all branches in a group get the exact same products, we can find the distinct count.
        const [totalQuery] = await db
            .select({
                uniqueProducts: count(sql`DISTINCT ${branchInventory.organizationInventoryId}`)
            })
            .from(branchInventory)
            .innerJoin(branches, eq(branchInventory.branchId, branches.id))
            .where(
                and(
                    eq(branches.groupId, groupId),
                    isNull(branchInventory.deletedAt),
                    eq(branchInventory.isActive, true)
                )
            )

        // Convert the array into a friendly Map-like dictionary: { [branchId]: productCount }
        const counts: Record<number, number> = {}
        for (const item of assignmentsQuery) {
            counts[item.branchId] = item.productCount
        }

        return NextResponse.json({
            counts,
            totalGroupProducts: totalQuery?.uniqueProducts || 0
        })

    } catch (e: any) {
        console.error("Error fetching group branch counts:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
