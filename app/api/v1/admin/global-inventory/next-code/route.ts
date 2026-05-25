import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { and, desc, eq, isNull } from "drizzle-orm"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { globalProducts } from "@/db/schema"

const DEFAULT_PRODUCT_CODE = "PRD-001"

function incrementProductCode(productCode?: string | null) {
  const normalizedCode = productCode?.trim()
  const match = normalizedCode?.match(/^(.*?)(\d+)$/)

  if (!match) {
    return DEFAULT_PRODUCT_CODE
  }

  const [, prefix, numericSuffix] = match
  const nextNumber = Number.parseInt(numericSuffix, 10) + 1
  const nextSuffix = nextNumber.toString().padStart(numericSuffix.length, "0")

  return `${prefix}${nextSuffix}`
}

async function productCodeExists(productCode: string) {
  const [existingProduct] = await db
    .select({ id: globalProducts.id })
    .from(globalProducts)
    .where(
      and(
        eq(globalProducts.productCode, productCode),
        isNull(globalProducts.deletedAt)
      )
    )
    .limit(1)

  return Boolean(existingProduct)
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const [lastProduct] = await db
      .select({
        id: globalProducts.id,
        productCode: globalProducts.productCode,
      })
      .from(globalProducts)
      .where(isNull(globalProducts.deletedAt))
      .orderBy(desc(globalProducts.createdAt), desc(globalProducts.id))
      .limit(1)

    let productCode = incrementProductCode(lastProduct?.productCode)
    let attempts = 0

    while (await productCodeExists(productCode)) {
      productCode = incrementProductCode(productCode)
      attempts += 1

      if (attempts >= 100) {
        return NextResponse.json(
          { error: "Unable to generate a unique product code" },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { productCode },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error: any) {
    console.error("Error generating next product code:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
