import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { branchProducts, auditLogs } from "@/db/schema"
import { eq } from "drizzle-orm"

// POST /api/v1/inventory/branch-products/restock - Update stock quantity
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    
    // Allow BRANCH_ADMIN, HEAD_OFFICE, and SUPER_ADMIN to restock
    const allowedRoles = ["BRANCH_ADMIN", "HEAD_OFFICE", "SUPER_ADMIN"]
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { branchProductId, quantity, type } = body // type: 'add' or 'set'

    if (!branchProductId || quantity === undefined) {
      return NextResponse.json({ error: "Branch product ID and quantity are required" }, { status: 400 })
    }

    const [existing] = await db.select().from(branchProducts).where(eq(branchProducts.id, branchProductId)).limit(1)
    if (!existing) {
      return NextResponse.json({ error: "Branch product not found" }, { status: 404 })
    }

    const newQuantity = type === "add" ? existing.stockQuantity + quantity : quantity

    const [updated] = await db.update(branchProducts)
      .set({
        stockQuantity: newQuantity,
        lastRestockDate: new Date(),
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
      action: "restock_product",
      entity: "branch_products",
      entityId: branchProductId.toString(),
      metadata: { previousQuantity: existing.stockQuantity, newQuantity, type }
    })

    return NextResponse.json({ product: updated })
  } catch (error: any) {
    console.error("Error restocking product:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

