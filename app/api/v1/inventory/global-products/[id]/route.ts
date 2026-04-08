import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant } from "@/lib/db"
import { globalProducts, auditLogs } from "@/db/schema"
import { eq, and, ne } from "drizzle-orm"

// GET /api/v1/inventory/global-products/[id] - Get single product
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const { id } = params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const productId = parseInt(params.id)
    const [product] = await withTenant(session.user as any, async (tx) => 
      tx.select().from(globalProducts).where(eq(globalProducts.id, productId)).limit(1)
    ) as any[]

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      delete (product as any).basePrice
    }

    return NextResponse.json({ product })
  } catch (error: any) {
    console.error("Error fetching product:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// PUT /api/v1/inventory/global-products/[id] - Update product (Super Admin)
export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const params = await props.params
    const productId = parseInt(params.id)
    const body = await req.json()
    const { productCode, name, description, categoryId, imageUrl, basePrice, unit, status, metadata } = body

    // Check if product code already exists
    if (productCode) {
      const start = Date.now()
      const [existingProductWithCode] = await withTenant(session.user as any, async (tx) => 
        tx.select()
          .from(globalProducts)
          .where(
            and(
              eq(globalProducts.productCode, productCode.toString().trim()),
              ne(globalProducts.id, productId)
            )
          )
          .limit(1)
      ) as any[]

      console.log(`[UpdateProduct] Check for duplicate code '${productCode}' took ${Date.now() - start}ms. Found: ${!!existingProductWithCode}`)

      if (existingProductWithCode) {
        return NextResponse.json({ error: "Product code already exists" }, { status: 400 })
      }
    }

    // Check if product exists
    const [existingProduct] = await withTenant(session.user as any, async (tx) => 
      tx.select().from(globalProducts).where(eq(globalProducts.id, productId)).limit(1)
    ) as any[]
    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Update product
    const [updatedProduct] = await withTenant(session.user as any, async (tx) => 
      tx.update(globalProducts)
        .set({
          ...(productCode && { productCode }),
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(categoryId !== undefined && { categoryId }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(basePrice !== undefined && { basePrice }),
          ...(unit && { unit }),
          ...(status && { status }),
          ...(metadata !== undefined && { metadata }),
          updatedAt: new Date()
        })
        .where(eq(globalProducts.id, productId))
        .returning()
    ) as any[]

    // Log audit
    await withTenant(session.user as any, async (tx) => 
      tx.insert(auditLogs).values({
        userId: (session.user as any).id,
        organizationId: null,
        branchId: null,
        action: "update_global_product",
        entity: "global_products",
        entityId: productId.toString(),
        metadata: { changes: body }
      })
    )

    return NextResponse.json({ product: updatedProduct })
  } catch (error: any) {
    console.error("Error updating product:", error)

    // Handle unique constraint violation (Postgres code 23505)
    if (error.code === '23505' || (error.message && error.message.includes('unique constraint') && error.message.includes('product_code'))) {
      return NextResponse.json({ error: "Product code already exists" }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// DELETE /api/v1/inventory/global-products/[id] - Delete product (Super Admin)
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const params = await props.params
    const productId = parseInt(params.id)

    // Check if product exists
    const [existingProduct] = await withTenant(session.user as any, async (tx) => 
      tx.select().from(globalProducts).where(eq(globalProducts.id, productId)).limit(1)
    ) as any[]
    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Soft delete by setting status to inactive
    await withTenant(session.user as any, async (tx) => 
      tx.update(globalProducts)
        .set({ status: "soft_deleted", updatedAt: new Date() })
        .where(eq(globalProducts.id, productId))
    )

    // Log audit
    await withTenant(session.user as any, async (tx) => 
      tx.insert(auditLogs).values({
        userId: (session.user as any).id,
        organizationId: null,
        branchId: null,
        action: "delete_global_product",
        entity: "global_products",
        entityId: productId.toString(),
        metadata: { productCode: existingProduct.productCode }
      })
    )

    return NextResponse.json({ message: "Product deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting product:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

