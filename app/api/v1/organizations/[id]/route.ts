export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { invalidateByPrefix } from "@/lib/cache-utils"
import {
  organizations,
  branches,
  users,
  orders,
  headOffices,
  employeeCredentials,
  organizationSettings,
  orgMetrics,
  sessions,
  auditLogs,
  notifications,
  organizationProducts,
  organizationInventory,
  categories,
  products,
  skus,
  inventory,
  suppliers,
  budgets,
  groups,
  systemLogs,
  groupAuditLogs
} from "@/db/schema"
import { eq, count, and, ne, isNull } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(
  _: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"]
    if (!allowedRoles.includes(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const params = await props.params
    const orgId = Number(params.id)

    if (scope.role !== "SUPER_ADMIN" && scope.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden: You do not have access to this organization" }, { status: 403 })
    }

    const [item] = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      return tx.select().from(organizations).where(eq(organizations.id, orgId))
    }

    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await getRequestScope()
    if (!scope || scope.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const params = await props.params
    const { id } = params
    const body = await req.json().catch(() => ({}))
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

    const item = await withSuperAdmin(async (tx) => {
      const patch: any = {}

      if (body.name !== undefined) {
        const name = String(body.name).trim()
        const [exists] = await tx.select({ id: organizations.id })
          .from(organizations)
          .where(and(eq(organizations.name, name), ne(organizations.id, Number(id))))
          .limit(1)
        if (exists) throw new Error(`Organization with name '${name}' already exists`)
        patch.name = name
      }

      if (body.code !== undefined) {
        const code = String(body.code).trim().toUpperCase()
        const [exists] = await tx.select({ id: organizations.id })
          .from(organizations)
          .where(and(eq(organizations.code, code), ne(organizations.id, Number(id))))
          .limit(1)
        if (exists) throw new Error(`Organization with code '${code}' already exists`)
        patch.code = code
      }

      if (body.status !== undefined) {
        const normalized = String(body.status).toLowerCase()
        const validStatuses = ['active', 'inactive', 'suspended']
        if (!validStatuses.includes(normalized)) throw new Error(`Status must be one of: ${validStatuses.join(', ')}`)
        patch.status = normalized
      }

      patch.updatedAt = new Date()
      const [updated] = await tx.update(organizations).set(patch).where(eq(organizations.id, Number(id))).returning()
      return updated
    })

    await invalidateByPrefix('organizations')
    return NextResponse.json({ item })
  } catch (e: any) {
    if (e.message?.includes('already exists') || e.message?.includes('Status must be')) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 500 })
  }
}

export async function DELETE(
  _: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await getRequestScope()
    if (!scope || scope.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const params = await props.params
    const orgId = Number(params.id)

    await withSuperAdmin(async (tx) => {
      const [existing] = await tx.select().from(organizations).where(eq(organizations.id, orgId))
      if (!existing) throw new Error("Organization not found")

      // Validations
      const [activeBranchCount]: any[] = await tx.select({ val: count() }).from(branches).where(and(eq(branches.organizationId, orgId), eq(branches.status, 'active')))
      if (activeBranchCount.val > 0) throw new Error(`Cannot delete: This company has ${activeBranchCount.val} active branch(es).`)

      const [activeUserCount]: any[] = await tx.select({ val: count() }).from(users).where(and(eq(users.organizationId, orgId), eq(users.isActive, true), isNull(users.deletedAt)))
      if (activeUserCount.val > 0) throw new Error(`Cannot delete: This company has ${activeUserCount.val} active user(s).`)

      const [orderCount]: any[] = await tx.select({ val: count() }).from(orders).where(eq(orders.organizationId, orgId))
      if (orderCount.val > 0) throw new Error(`Cannot delete: Historical order records were found.`)

      const [groupCount]: any[] = await tx.select({ val: count() }).from(groups).where(and(eq(groups.organizationId, orgId), ne(groups.status, 'deleted')))
      if (groupCount.val > 0) throw new Error(`Cannot delete: This organization has ${groupCount.val} active group(s).`)

      const [hoCount]: any[] = await tx.select({ val: count() }).from(headOffices).where(eq(headOffices.organizationId, orgId))
      if (hoCount.val > 0) throw new Error(`Cannot delete: A Head Office record exists.`)

      // Cleanup
      await tx.delete(auditLogs).where(eq(auditLogs.organizationId, orgId))
      await tx.delete(systemLogs).where(eq(systemLogs.organizationId, orgId))
      await tx.delete(groupAuditLogs).where(eq(groupAuditLogs.organizationId, orgId))
      await tx.delete(notifications).where(eq(notifications.organizationId, orgId))
      await tx.delete(sessions).where(eq(sessions.organizationId, orgId))
      await tx.delete(organizationSettings).where(eq(organizationSettings.organizationId, orgId))
      await tx.delete(orgMetrics).where(eq(orgMetrics.organizationId, orgId))
      await tx.delete(inventory).where(eq(inventory.organizationId, orgId))
      await tx.delete(organizationInventory).where(eq(organizationInventory.organizationId, orgId))
      await tx.delete(organizationProducts).where(eq(organizationProducts.organizationId, orgId))
      await tx.delete(skus).where(eq(skus.organizationId, orgId))
      await tx.delete(products).where(eq(products.organizationId, orgId))
      await tx.delete(categories).where(eq(categories.organizationId, orgId))
      await tx.delete(suppliers).where(eq(suppliers.organizationId, orgId))
      await tx.delete(budgets).where(eq(budgets.organizationId, orgId))
      await tx.delete(employeeCredentials).where(eq(employeeCredentials.organizationId, orgId))
      await tx.delete(groups).where(eq(groups.organizationId, orgId))
      await tx.delete(organizations).where(eq(organizations.id, orgId))
    })

    await invalidateByPrefix('organizations')
    await invalidateByPrefix('branches')

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message?.startsWith('Cannot delete:') || e.message === 'Organization not found') {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }

    const errorCode = String(e.code || e.originalError?.code || "")
    const errorMessage = String(e.message || "").toLowerCase()
    if (errorCode === "23503" || errorMessage.includes("foreign key") || errorMessage.includes("violates")) {
      return NextResponse.json({ error: "Cannot delete: A database dependency (foreign key) is still blocking deletion." }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 })
  }
}

