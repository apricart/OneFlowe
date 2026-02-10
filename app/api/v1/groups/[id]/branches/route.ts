import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { groups, branches, groupAuditLogs } from "@/db/schema"
import { eq, inArray, and, sql } from "drizzle-orm"

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const groupId = parseInt(id)
        if (isNaN(groupId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

        const assignedBranches = await db
            .select()
            .from(branches)
            .where(eq(branches.groupId, groupId))

        return NextResponse.json({ branches: assignedBranches })
    } catch (e: any) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const role = (session.user as any).role
        const userOrgId = (session.user as any).organizationId
        if (role !== "SUPER_ADMIN" && role !== "HEAD_OFFICE") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const groupId = parseInt(id)
        if (isNaN(groupId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

        const [group] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, groupId))
            .limit(1)

        if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })

        // Security check: Head Office can only manage branches for groups in their org
        if (role === "HEAD_OFFICE" && group.organizationId !== userOrgId) {
            return NextResponse.json({ error: "Forbidden: You can only manage branches for groups within your own organization" }, { status: 403 })
        }

        const body = await req.json()
        const { branchIds } = body // integer[]

        if (!Array.isArray(branchIds)) {
            return NextResponse.json({ error: "branchIds array required" }, { status: 400 })
        }

        await db.transaction(async (tx) => {
            // 1. Branch exclusivity validation (Atomic check)
            if (branchIds.length > 0) {
                const conflictBranches = await tx
                    .select()
                    .from(branches)
                    .where(
                        and(
                            inArray(branches.id, branchIds),
                            sql`${branches.groupId} IS NOT NULL`,
                            sql`${branches.groupId} != ${groupId}`
                        )
                    )

                if (conflictBranches.length > 0) {
                    const names = conflictBranches.map(b => b.name).join(", ")
                    throw new Error(`These branches are already assigned to another group: ${names}. Please release them first.`)
                }

                // 2. Validate that branches actually belong to this organization
                const invalidBranches = await tx
                    .select()
                    .from(branches)
                    .where(
                        and(
                            inArray(branches.id, branchIds),
                            sql`${branches.organizationId} != ${group.organizationId}`
                        )
                    )

                if (invalidBranches.length > 0) {
                    throw new Error(`Unauthorized: Some branches do not belong to this organization.`)
                }
            }

            // 3. Remove all current branches from this group
            await tx
                .update(branches)
                .set({ groupId: null })
                .where(eq(branches.groupId, groupId))

            // 4. Assign new branches (if any)
            let assignedCount = 0
            if (branchIds.length > 0) {
                const result = await tx
                    .update(branches)
                    .set({ groupId: groupId })
                    .where(
                        and(
                            inArray(branches.id, branchIds),
                            eq(branches.organizationId, group.organizationId)
                        )
                    )
                assignedCount = result.rowCount || 0
            }

            // 5. Update group status based on assignment
            await tx
                .update(groups)
                .set({
                    status: assignedCount > 0 ? "connected" : "not connected",
                    updatedAt: new Date()
                })
                .where(eq(groups.id, groupId))

            // 6. Log assignment action
            await tx.insert(groupAuditLogs).values({
                organizationId: group.organizationId,
                groupId,
                action: "ASSIGN_BRANCHES",
                performedByUserId: (session.user as any).id,
                performedByRole: role,
                metadata: {
                    branchIds,
                },
            })
        })

        return NextResponse.json({ message: "Branch assignments updated" })
    } catch (e: any) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
