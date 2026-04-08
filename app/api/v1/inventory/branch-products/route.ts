import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant } from "@/lib/db"
import { branchProducts, globalProducts, organizationProducts, auditLogs, categories } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getCached, invalidateByPrefix, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole, organizationId: userOrgId, branchId: userBranchId } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    const { searchParams } = new URL(req.url)
    const branchIdParam = searchParams.get("branchId")
    const organizationIdParam = searchParams.get("organizationId")

    if (!branchIdParam || !organizationIdParam) {
      return NextResponse.json({ error: "Branch ID and Organization ID are required" }, { status: 400 })
    }

    const branchId = parseInt(branchIdParam)
    const organizationId = parseInt(organizationIdParam)

    if (role === "BRANCH_ADMIN") {
      if (userBranchId !== branchId || userOrgId !== organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (role === "HEAD_OFFICE") {
      if (userOrgId !== organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const cacheKey = scopedCacheKey('inv:branch-products', { orgId: organizationId, branchId })

    const items = await getCached(cacheKey, async () => {
      return await withTenant(session.user as any, async (tx) => {
        const isSuperAdmin = role === "SUPER_ADMIN"
        return tx
          .select({
            id: globalProducts.id,
            productCode: globalProducts.productCode,
            name: globalProducts.name,
            description: globalProducts.description,
            categoryId: globalProducts.categoryId,
            categoryName: categories.name,
            imageUrl: globalProducts.imageUrl,
            basePrice: isSuperAdmin ? globalProducts.basePrice : sql`NULL`,
            unit: globalProducts.unit,
            status: globalProducts.status,
            customName: organizationProducts.customName,
            customDescription: organizationProducts.customDescription,
            customPrice: organizationProducts.customPrice,
            customImageUrl: organizationProducts.customImageUrl,
            branchProductId: branchProducts.id,
            isAvailable: branchProducts.isAvailable,
            customNotes: branchProducts.customNotes
          })
          .from(globalProducts)
          .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
          .innerJoin(
            organizationProducts,
            and(
              eq(organizationProducts.globalProductId, globalProducts.id),
              eq(organizationProducts.organizationId, organizationId),
              eq(organizationProducts.isEnabled, true)
            )
          )
          .leftJoin(
            branchProducts,
            and(
              eq(branchProducts.globalProductId, globalProducts.id),
              eq(branchProducts.branchId, branchId)
            )
          )
          .where(eq(globalProducts.status, "active"))
      })
    }, CACHE_TTL.INVENTORY)

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error("Error fetching branch products:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { role: userRole, organizationId: userOrgId, branchId: userBranchId, id: userId } = session.user as any
    const role = (userRole || "").toUpperCase().replace(/\s+/g, '_')

    if (role !== "SUPER_ADMIN" && role !== "HEAD_OFFICE" && role !== "BRANCH_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { branchProductId, isAvailable, customNotes } = body

    if (!branchProductId) {
      return NextResponse.json({ error: "Branch product ID is required" }, { status: 400 })
    }

    const conditions = [eq(branchProducts.id, branchProductId)]

    if (role === "HEAD_OFFICE") {
      if (!userOrgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
      conditions.push(eq(branchProducts.organizationId, Number(userOrgId)))
    } else if (role === "BRANCH_ADMIN") {
      if (!userOrgId || !userBranchId) return NextResponse.json({ error: "Organization and branch context required" }, { status: 400 })
      conditions.push(eq(branchProducts.organizationId, Number(userOrgId)))
      conditions.push(eq(branchProducts.branchId, Number(userBranchId)))
    }

    const [updated] = await withTenant(session.user as any, async (tx) => {
      const [u] = await tx.update(branchProducts)
        .set({
          ...(isAvailable !== undefined && { isAvailable }),
          ...(customNotes !== undefined && { customNotes }),
          updatedByUserId: userId,
          updatedAt: new Date()
        })
        .where(and(...conditions))
        .returning() as any[]
      
      if (u) {
        await tx.insert(auditLogs).values({
          userId: userId,
          organizationId: u.organizationId,
          branchId: u.branchId,
          action: "update_branch_product",
          entity: "branch_products",
          entityId: branchProductId.toString(),
          metadata: { changes: body }
        })
      }
      return [u]
    }) as any[]

    if (!updated) {
      return NextResponse.json({ error: "Branch product not found or access denied" }, { status: 404 })
    }

    await invalidateByPrefix('inv:branch-products')
    return NextResponse.json({ product: updated })
  } catch (error: any) {
    console.error("Error updating branch product:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

