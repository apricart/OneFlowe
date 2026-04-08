import { NextResponse, type NextRequest } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { globalProducts, organizationInventory, branchInventory, branches } from "@/db/schema"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const orgIdsParam = url.searchParams.get("organizationIds")
    const groupIdsParam = url.searchParams.get("groupIds")
    const branchIdsParam = url.searchParams.get("branchIds")

    let orgIds = orgIdsParam ? orgIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : []
    const groupIds = groupIdsParam ? groupIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : []
    let branchIds = branchIdsParam ? branchIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : []

    const items = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      if (groupIds.length > 0 && branchIds.length === 0) {
        const groupBranches = await tx.select({ id: branches.id }).from(branches).where(inArray(branches.groupId, groupIds))
        branchIds = groupBranches.map((b: any) => b.id)
      }

      const conditions: any[] = [isNull(globalProducts.deletedAt)]

      if (branchIds.length > 0) {
        const assignedIds = await tx.select({ id: globalProducts.id })
          .from(branchInventory)
          .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
          .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
          .where(and(inArray(branchInventory.branchId, branchIds), eq(branchInventory.isActive, true)))
          .then((res: any[]) => res.map(p => p.id))
        
        if (assignedIds.length === 0) return []
        conditions.push(inArray(globalProducts.id, assignedIds))
      } else if (orgIds.length > 0) {
        const assignedIds = await tx.select({ id: globalProducts.id })
          .from(organizationInventory)
          .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
          .where(and(inArray(organizationInventory.organizationId, orgIds), eq(organizationInventory.isActive, true)))
          .then((res: any[]) => res.map(p => p.id))

        if (assignedIds.length === 0) return []
        conditions.push(inArray(globalProducts.id, assignedIds))
      }

      return tx.select({
        id: globalProducts.id,
        name: globalProducts.name,
        productCode: globalProducts.productCode,
      }).from(globalProducts)
        .where(and(...conditions))
        .orderBy(globalProducts.name)
    }

    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

