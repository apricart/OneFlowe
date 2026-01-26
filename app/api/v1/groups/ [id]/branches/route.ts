import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { groups, branches, groupAuditLogs } from "@/db/schema"
import { eq, inArray, and, sql } from "drizzle-orm"

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const groupId = parseInt(params.id)
        if (isNaN(groupId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

        const assignedBranches = await db
            .select()
            .from(branches)
            .where(eq(branches.groupId, groupId))

        return NextResponse.json({ branches: assignedBranches })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const role = (session.user as any).role
        if (role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const groupId = parseInt(params.id)
        if (isNaN(groupId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

        const [group] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, groupId))
            .limit(1)

        if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })

        const body = await req.json()
        const { branchIds } = body // integer[]

        if (!Array.isArray(branchIds)) {
            return NextResponse.json({ error: "branchIds array required" }, { status: 400 })
        }

        if (branchIds.length > 0) {
            const conflictBranches = await db
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
                return NextResponse.json({
                    error: `These branches are already assigned to another group: ${names}`
                }, { status: 400 })
            }
        }

        await db.transaction(async (tx) => {
            // 1. Remove all current branches from this group
            await tx
                .update(branches)
                .set({ groupId: null })
                .where(eq(branches.groupId, groupId))

            // 2. Assign new branches (if any)
            if (branchIds.length > 0) {
                await tx
                    .update(branches)
                    .set({ groupId: groupId })
                    .where(
                        and(
                            inArray(branches.id, branchIds),
                            eq(branches.organizationId, group.organizationId)
                        )
                    )
            }

            // 3. Log assignment action
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
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
