import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { groups, groupAuditLogs, branches, branchInventory, organizationInventory, globalProducts } from "@/db/schema"
import { eq, and, sql, count, isNull, inArray } from "drizzle-orm"
import { invalidateByPrefix } from "@/lib/cache-utils"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await props.params
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const user = session.user as any
        const groupId = parseInt(id)
        if (isNaN(groupId)) return NextResponse.json({ error: "Invalid Group ID" }, { status: 400 })

        const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

        const group = await runner(async (tx: any) => {
            const [g] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1)
            return g
        })

        if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })

        return NextResponse.json({ group })
    } catch (e: any) {
        console.error("Error fetching group:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await props.params
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const user = session.user as any
        if (user.role !== "SUPER_ADMIN" && user.role !== "HEAD_OFFICE") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const groupId = parseInt(id)
        if (isNaN(groupId)) return NextResponse.json({ error: "Invalid Group ID" }, { status: 400 })

        const body = await req.json()
        const { name, description } = body

        const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

        const result = await runner(async (tx: any) => {
            const [existing] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1)
            if (!existing) throw new Error("Group not found")

            // Collision check
            if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
                const [collision] = await tx.select().from(groups).where(and(
                    eq(groups.organizationId, existing.organizationId),
                    sql`lower(${groups.name}) = lower(${name})`,
                    sql`${groups.id} != ${groupId}`,
                    sql`${groups.status} != 'deleted'`
                )).limit(1)
                if (collision) throw new Error(`The name "${name}" is already used.`)
            }

            const [updated] = await tx.update(groups).set({
                name: name ?? existing.name,
                description: description ?? existing.description,
                updatedAt: new Date(),
            }).where(eq(groups.id, groupId)).returning()

            await tx.insert(groupAuditLogs).values({
                organizationId: existing.organizationId,
                groupId: groupId,
                action: "UPDATE_GROUP",
                performedByUserId: user.id,
                performedByRole: user.role,
                metadata: { old: { name: existing.name }, new: { name: updated.name } },
            })

            return updated
        })

        await invalidateByPrefix('group')
        return NextResponse.json({ group: result })
    } catch (e: any) {
        console.error("Error updating group:", e)
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: e.message?.includes("found") ? 404 : 400 })
    }
}

export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await props.params
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const user = session.user as any
        if (user.role !== "SUPER_ADMIN" && user.role !== "HEAD_OFFICE") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const groupId = parseInt(id)
        if (isNaN(groupId)) return NextResponse.json({ error: "Invalid Group ID" }, { status: 400 })

        const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

        await runner(async (tx: any) => {
            const [existing] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1)
            if (!existing) throw new Error("Group not found")

            const [branchCount] = await tx.select({ val: count() }).from(branches).where(eq(branches.groupId, groupId))
            if (branchCount.val > 0) {
                // Auto-clean stale records
                const branchIdsInGroup = await tx.select({ id: branches.id }).from(branches).where(eq(branches.groupId, groupId))
                if (branchIdsInGroup.length > 0) {
                    const branchIdList = branchIdsInGroup.map((b: any) => b.id)
                    const staleRecords = await tx.select({ biId: branchInventory.id })
                        .from(branchInventory)
                        .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
                        .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
                        .where(and(
                            inArray(branchInventory.branchId, branchIdList),
                            isNull(branchInventory.deletedAt),
                            sql`${globalProducts.deletedAt} IS NOT NULL`
                        ))

                    if (staleRecords.length > 0) {
                        await tx.update(branchInventory).set({ deletedAt: new Date(), updatedAt: new Date() }).where(inArray(branchInventory.id, staleRecords.map((r: any) => r.biId)))
                    }
                }

                const [productCount] = await tx.select({ val: count() })
                    .from(branchInventory)
                    .innerJoin(branches, eq(branchInventory.branchId, branches.id))
                    .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
                    .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
                    .where(and(eq(branches.groupId, groupId), isNull(branchInventory.deletedAt), isNull(globalProducts.deletedAt)))

                if (productCount.val > 0) throw new Error(`Cannot delete: This group has ${branchCount.val} branch(es) with ${productCount.val} product(s) assigned.`)
                throw new Error(`Cannot delete: This group has ${branchCount.val} branch(es) assigned.`)
            }

            await tx.update(groups).set({ status: 'deleted', updatedAt: new Date() }).where(eq(groups.id, groupId))

            await tx.insert(groupAuditLogs).values({
                organizationId: existing.organizationId,
                groupId: groupId,
                action: "DELETE_GROUP",
                performedByUserId: user.id,
                performedByRole: user.role,
                metadata: { name: existing.name },
            })
        })

        await invalidateByPrefix('group')
        return NextResponse.json({ message: "Group deleted successfully" })
    } catch (e: any) {
        console.error("Error deleting group:", e)
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 400 })
    }
}

