export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant } from "@/lib/db"
import { organizationProducts, globalProducts, auditLogs, branchInventory, branches } from "@/db/schema"
import { eq, and, sql, inArray, exists } from "drizzle-orm"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole, organizationId: userOrgId } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    const { searchParams } = new URL(req.url)
    const organizationIdsParam = searchParams.get("organizationId")
    const groupIdsParam = searchParams.get("groupIds")
    const parsedOrgIds = organizationIdsParam ? organizationIdsParam.split(',').map(n => parseInt(n)).filter(n => !isNaN(n)) : []
    const parsedGroupIds = groupIdsParam ? groupIdsParam.split(',').map(n => parseInt(n)).filter(n => !isNaN(n)) : []

    if (role !== "SUPER_ADMIN") {
      if (parsedOrgIds.length > 0 && !parsedOrgIds.includes(userOrgId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const cacheKey = scopedCacheKey('inv:org-products', { 
        orgId: parsedOrgIds.join(','),
        role: role
    })

    const items = await getCached(cacheKey, async () => {
      return await withTenant(session.user as any, async (tx) => {
        const isSuperAdmin = role === "SUPER_ADMIN"
        const query = tx
          .select({
            id: globalProducts.id,
            productCode: globalProducts.productCode,
            name: globalProducts.name,
            description: globalProducts.description,
            categoryId: globalProducts.categoryId,
            imageUrl: globalProducts.imageUrl,
            basePrice: isSuperAdmin ? globalProducts.basePrice : sql`NULL`,
            unit: globalProducts.unit,
            status: globalProducts.status,
            orgProductId: organizationProducts.id,
            isEnabled: organizationProducts.isEnabled,
            customName: organizationProducts.customName,
            customDescription: organizationProducts.customDescription,
            customPrice: organizationProducts.customPrice,
            customImageUrl: organizationProducts.customImageUrl,
            tags: organizationProducts.tags,
            priority: organizationProducts.priority
          })
          .from(globalProducts)

        const activeOrgId = parsedOrgIds.length > 0 ? parsedOrgIds[0] : userOrgId

        if (activeOrgId) {
          query.leftJoin(
            organizationProducts,
            and(
              eq(organizationProducts.globalProductId, globalProducts.id),
              eq(organizationProducts.organizationId, activeOrgId)
            )
          )
        }

        const whereConditions: any[] = [eq(globalProducts.status, "active")]

        if (parsedGroupIds.length > 0) {
          whereConditions.push(
            exists(
              tx.select()
                .from(branchInventory)
                .innerJoin(branches, eq(branchInventory.branchId, branches.id))
                .innerJoin(organizationProducts, eq(branchInventory.organizationInventoryId, organizationProducts.id))
                .where(
                  and(
                    eq(organizationProducts.globalProductId, globalProducts.id),
                    inArray(branches.groupId, parsedGroupIds),
                    eq(branchInventory.isActive, true)
                  )
                )
            )
          )
        } else if (parsedOrgIds.length > 0) {
            whereConditions.push(
                exists(
                    tx.select()
                    .from(organizationProducts)
                    .where(and(
                        eq(organizationProducts.globalProductId, globalProducts.id),
                        inArray(organizationProducts.organizationId, parsedOrgIds)
                    ))
                )
            )
        }

        return query.where(and(...whereConditions))
      })
    }, CACHE_TTL.LISTING)

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error("Error fetching organization products:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole, organizationId: userOrgId, id: userId } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    if (role !== "SUPER_ADMIN" && role !== "HEAD_OFFICE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { organizationProductId, isEnabled, customName, customDescription, customPrice, customImageUrl, tags, priority } = body

    if (!organizationProductId) {
      return NextResponse.json({ error: "Organization product ID is required" }, { status: 400 })
    }

    const conditions = [eq(organizationProducts.id, organizationProductId)]

    if (role === "HEAD_OFFICE") {
      if (!userOrgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
      conditions.push(eq(organizationProducts.organizationId, Number(userOrgId)))
    }

    const [updated] = await withTenant(session.user as any, async (tx) => {
      const [u] = await tx.update(organizationProducts)
        .set({
          ...(isEnabled !== undefined && { isEnabled }),
          ...(customName !== undefined && { customName }),
          ...(customDescription !== undefined && { customDescription }),
          ...(customPrice !== undefined && { customPrice }),
          ...(customImageUrl !== undefined && { customImageUrl }),
          ...(tags !== undefined && { tags }),
          ...(priority !== undefined && { priority }),
          updatedByUserId: userId,
          updatedAt: new Date()
        })
        .where(and(...conditions))
        .returning() as any[]
      
      if (u) {
        await tx.insert(auditLogs).values({
          userId: userId,
          organizationId: u.organizationId,
          branchId: null,
          action: "update_org_product",
          entity: "organization_products",
          entityId: organizationProductId.toString(),
          metadata: { changes: body }
        })
      }
      return [u]
    }) as any[]

    if (!updated) {
      return NextResponse.json({ error: "Organization product not found or access denied" }, { status: 404 })
    }

    await invalidateByPrefix('inv:org-products')
    await invalidateByPrefix('inv:branch-products')

    return NextResponse.json({ product: updated })
  } catch (error: any) {
    console.error("Error updating organization product:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

