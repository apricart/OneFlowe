import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { branchProducts, globalProducts, organizationProducts, auditLogs } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"

// GET /api/v1/inventory/branch-products - Get products for branch
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    const userOrgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get("branchId")
    const organizationId = searchParams.get("organizationId")

    if (!branchId || !organizationId) {
      return NextResponse.json({ error: "Branch ID and Organization ID are required" }, { status: 400 })
    }

    // Access control: users can only view their own organization's branches
    // BRANCH_ADMIN can only view their own branch
    if (userRole === "BRANCH_ADMIN") {
      if (userBranchId !== parseInt(branchId) || userOrgId !== parseInt(organizationId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (userRole === "HEAD_OFFICE") {
      if (userOrgId !== parseInt(organizationId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }
    // SUPER_ADMIN can view any branch

    // Fetch all enabled organization products with branch-specific data
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
        // Organization overrides
        customName: organizationProducts.customName,
        customDescription: organizationProducts.customDescription,
        customPrice: organizationProducts.customPrice,
        customImageUrl: organizationProducts.customImageUrl,
        // Branch specific (visibility + notes only)
        branchProductId: branchProducts.id,
        isAvailable: branchProducts.isAvailable,
        customNotes: branchProducts.customNotes
      })
      .from(globalProducts)
      .innerJoin(
        organizationProducts,
        and(
          eq(organizationProducts.globalProductId, globalProducts.id),
          eq(organizationProducts.organizationId, parseInt(organizationId)),
          eq(organizationProducts.isEnabled, true)
        )
      )
      .leftJoin(
        branchProducts,
        and(
          eq(branchProducts.globalProductId, globalProducts.id),
          eq(branchProducts.branchId, parseInt(branchId))
        )
      )
      .where(eq(globalProducts.status, "active"))

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error("Error fetching branch products:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/v1/inventory/branch-products - Update branch product stock/availability
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { branchProductId, isAvailable, customNotes } = body

    if (!branchProductId) {
      return NextResponse.json({ error: "Branch product ID is required" }, { status: 400 })
    }

    // Update branch product
    const [updated] = await db.update(branchProducts)
      .set({
        ...(isAvailable !== undefined && { isAvailable }),
        ...(customNotes !== undefined && { customNotes }),
        updatedByUserId: session.user.id as string,
        updatedAt: new Date()
      })
      .where(eq(branchProducts.id, branchProductId))
      .returning()

    // Log audit
    await db.insert(auditLogs).values({
      userId: session.user.id as string,
      organizationId: updated.organizationId,
      branchId: updated.branchId,
      action: "update_branch_product",
      entity: "branch_products",
      entityId: branchProductId.toString(),
      metadata: { changes: body }
    })

    return NextResponse.json({ product: updated })
  } catch (error: any) {
    console.error("Error updating branch product:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

