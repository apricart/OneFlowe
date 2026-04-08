import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin } from "@/lib/db"
import { globalProducts, categories, auditLogs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { cascadeGlobalProductFieldUpdate } from "@/lib/inventory-cascade"

function parseCsv(content: string) {
  const lines = content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0)
  if (lines.length < 2) return { rows: [], errors: ["CSV must have header and data"] }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const rows: any[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: Column count mismatch`)
      continue
    }

    const row: any = {}
    headers.forEach((header, idx) => { row[header] = values[idx] || "" })

    if (!(row.productcode || row["product_code"]) || !row.name) {
      errors.push(`Row ${i + 1}: Required fields missing`)
      continue
    }

    rows.push({
      productCode: (row.productcode || row["product_code"] || "").toUpperCase(),
      name: row.name || "",
      description: row.description || "",
      category: row.category || "",
      imageUrl: row.imageurl || row["image_url"] || "",
      basePrice: row.baseprice || row["base_price"] || "",
      unit: row.unit || "unit",
      status: row.status || "active",
      stockQuantity: row.stockquantity || row["stock_quantity"] || "0",
    })
  }

  return { rows, errors }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) return NextResponse.json({ error: "CSV required" }, { status: 400 })

    const fileContent = await file.text()
    const { rows, errors: parsingErrors } = parseCsv(fileContent)
    if (rows.length === 0) return NextResponse.json({ error: "No valid rows", parsingErrors }, { status: 400 })

    const result = await withSuperAdmin(async (tx: any) => {
      const allCategories = await tx.select().from(categories)
      const categoryMap = new Map(allCategories.map((c: any) => [c.name.toLowerCase(), c.id]))

      let successfulRows = 0
      let failedRows = 0
      const validationErrors: any[] = []

      for (const row of rows) {
        try {
          const basePrice = Math.round(parseFloat(row.basePrice || "0") * 100)
          const stockQuantity = parseInt(row.stockQuantity || "0")
          const categoryId = categoryMap.get(row.category.toLowerCase()) || null

          if (row.category && !categoryId) throw new Error(`Category "${row.category}" not found`)

          const [existing] = await tx.select().from(globalProducts).where(eq(globalProducts.productCode, row.productCode)).limit(1)

          if (existing) {
            const [updated] = await tx.update(globalProducts).set({
              name: row.name,
              description: row.description || null,
              categoryId,
              imageUrl: row.imageUrl || null,
              basePrice,
              unit: row.unit,
              status: row.status.toLowerCase() === "inactive" ? "inactive" : "active",
              stockQuantity,
              updatedAt: new Date(),
              lastSyncedAt: new Date(),
            }).where(eq(globalProducts.id, existing.id)).returning()

            const updates = []
            if (existing.name !== row.name) updates.push({ field: 'name', oldValue: existing.name, newValue: row.name })
            if (existing.basePrice !== basePrice) updates.push({ field: 'basePrice', oldValue: existing.basePrice, newValue: basePrice })
            if (existing.imageUrl !== (row.imageUrl || null)) updates.push({ field: 'imageUrl', oldValue: existing.imageUrl, newValue: row.imageUrl || null })

            if (updates.length > 0) {
              await cascadeGlobalProductFieldUpdate(updated.id, updates as any, user.id, tx)
            }
          } else {
            await tx.insert(globalProducts).values({
              productCode: row.productCode,
              name: row.name,
              description: row.description || null,
              categoryId,
              imageUrl: row.imageUrl || null,
              basePrice,
              unit: row.unit,
              status: row.status.toLowerCase() === "inactive" ? "inactive" : "active",
              stockQuantity,
              createdByUserId: user.id,
              lastSyncedAt: new Date(),
            })
          }
          successfulRows++
        } catch (e: any) {
          validationErrors.push({ productCode: row.productCode, error: e.message })
          failedRows++
        }
      }

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "import_products",
        entity: "global_products",
        entityId: "bulk_import",
        metadata: { totalRows: rows.length, successfulRows, failedRows },
      })

      return { successfulRows, failedRows, validationErrors, parsingErrors }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error importing products:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}


