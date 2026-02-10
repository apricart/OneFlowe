import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { groups, groupAuditLogs, branches } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const role = (session.user as any).role
        const orgId = (session.user as any).organizationId
        const groupId = parseInt(id)

        if (isNaN(groupId)) {
            return NextResponse.json({ error: "Invalid Group ID" }, { status: 400 })
        }

        const [group] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, groupId))
            .limit(1)

        if (!group) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 })
        }

        // Security check: Non-SUPER_ADMIN can only see groups in their org
        if (role !== "SUPER_ADMIN" && group.organizationId !== orgId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        return NextResponse.json({ group })
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

        if (role !== "SUPER_ADMIN" && role !== "HEAD_OFFICE") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const groupId = parseInt(id)
        if (isNaN(groupId)) {
            return NextResponse.json({ error: "Invalid Group ID" }, { status: 400 })
        }

        const body = await req.json()
        const { name, description, status } = body

        const [existing] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, groupId))
            .limit(1)

        if (!existing) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 })
        }

        // Security check: Head Office can only update groups in their org
        if (role === "HEAD_OFFICE" && existing.organizationId !== userOrgId) {
            return NextResponse.json({ error: "Forbidden: You can only edit groups within your own organization" }, { status: 403 })
        }

        // Collision check: Ensure new name isn't already used in this organization (case-insensitive)
        if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
            const [collision] = await db
                .select()
                .from(groups)
                .where(
                    and(
                        eq(groups.organizationId, existing.organizationId),
                        sql`lower(${groups.name}) = lower(${name})`,
                        sql`${groups.id} != ${groupId}`,
                        sql`${groups.status} != 'deleted'`
                    )
                )
                .limit(1)

            if (collision) {
                return NextResponse.json({ error: `The name "${name}" is already used by another group in your organization.` }, { status: 409 })
            }
        }

        const [updated] = await db
            .update(groups)
            .set({
                name: name ?? existing.name,
                description: description ?? existing.description,
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId))
            .returning()

        // Log action
        await db.insert(groupAuditLogs).values({
            organizationId: existing.organizationId,
            groupId: groupId,
            action: "UPDATE_GROUP",
            performedByUserId: (session.user as any).id,
            performedByRole: role,
            metadata: {
                old: { name: existing.name, description: existing.description, status: existing.status },
                new: { name: updated.name, description: updated.description, status: updated.status },
            },
        })

        return NextResponse.json({ group: updated })
    } catch (e: any) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const role = (session.user as any).role
        const userOrgId = (session.user as any).organizationId

        if (role !== "SUPER_ADMIN" && role !== "HEAD_OFFICE") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const groupId = parseInt(id)
        if (isNaN(groupId)) {
            return NextResponse.json({ error: "Invalid Group ID" }, { status: 400 })
        }

        const [existing] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, groupId))
            .limit(1)

        if (!existing) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 })
        }

        // Security check: Head Office can only delete groups in their org
        if (role === "HEAD_OFFICE" && existing.organizationId !== userOrgId) {
            return NextResponse.json({ error: "Forbidden: You can only delete groups within your own organization" }, { status: 403 })
        }

        // Soft delete: set status to 'deleted' and unlink branches
        await db.transaction(async (tx) => {
            // 1. Unlink branches
            await tx.update(branches).set({ groupId: null }).where(eq(branches.groupId, groupId))

            // 2. Mark group as deleted
            await tx.update(groups).set({
                status: 'deleted',
                updatedAt: new Date()
            }).where(eq(groups.id, groupId))

            // 3. Log the deletion
            await tx.insert(groupAuditLogs).values({
                organizationId: existing.organizationId,
                groupId: groupId,
                action: "DELETE_GROUP",
                performedByUserId: (session.user as any).id,
                performedByRole: role,
                metadata: {
                    name: existing.name,
                },
            })
        })

        return NextResponse.json({ message: "Group deleted successfully" })
    } catch (e: any) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
