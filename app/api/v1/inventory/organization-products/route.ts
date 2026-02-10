import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { organizationProducts, globalProducts, auditLogs } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"

// GET /api/v1/inventory/organization-products - Get products for organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    const userOrgId = (session.user as any).organizationId

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get("organizationId")

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 })
    }

    // Access control: users can only view their own organization's products
    // except SUPER_ADMIN who can view any organization
    if (userRole !== "SUPER_ADMIN" && userOrgId !== parseInt(organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch all products with organization-specific data
    const items = await db
      .select({
        id: globalProducts.id,
        productCode: globalProducts.productCode,
        name: globalProducts.name,
        description: globalProducts.description,
        categoryId: globalProducts.categoryId,
        imageUrl: globalProducts.imageUrl,
        basePrice: globalProducts.basePrice,
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
      .leftJoin(
        organizationProducts,
        and(
          eq(organizationProducts.globalProductId, globalProducts.id),
          eq(organizationProducts.organizationId, parseInt(organizationId))
        )
      )
      .where(eq(globalProducts.status, "active"))

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error("Error fetching organization products:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// PUT /api/v1/inventory/organization-products/[id] - Update organization product settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN" && userRole !== "HEAD_OFFICE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { organizationProductId, isEnabled, customName, customDescription, customPrice, customImageUrl, tags, priority } = body

    if (!organizationProductId) {
      return NextResponse.json({ error: "Organization product ID is required" }, { status: 400 })
    }

    // BOLA: Scope update to user's organization for non-SUPER_ADMIN
    const userOrgId = (session.user as any).organizationId
    const conditions = [eq(organizationProducts.id, organizationProductId)]

    if (userRole === "HEAD_OFFICE") {
      if (!userOrgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
      conditions.push(eq(organizationProducts.organizationId, Number(userOrgId)))
    }

    // Update organization product with ownership scope
    const [updated] = await db.update(organizationProducts)
      .set({
        ...(isEnabled !== undefined && { isEnabled }),
        ...(customName !== undefined && { customName }),
        ...(customDescription !== undefined && { customDescription }),
        ...(customPrice !== undefined && { customPrice }),
        ...(customImageUrl !== undefined && { customImageUrl }),
        ...(tags !== undefined && { tags }),
        ...(priority !== undefined && { priority }),
        updatedByUserId: (session.user as any).id,
        updatedAt: new Date()
      })
      .where(and(...conditions))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Organization product not found or access denied" }, { status: 404 })
    }

    // Log audit
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      organizationId: updated.organizationId,
      branchId: null,
      action: "update_org_product",
      entity: "organization_products",
      entityId: organizationProductId.toString(),
      metadata: { changes: body }
    })

    return NextResponse.json({ product: updated })
  } catch (error: any) {
    console.error("Error updating organization product:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

