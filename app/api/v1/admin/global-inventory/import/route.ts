import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { globalProducts, categories, auditLogs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { cascadeGlobalProductFieldUpdate } from "@/lib/inventory-cascade"

function parseCsv(content: string) {
  const lines = content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0)
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV must have at least a header row and one data row"] }
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const errors: string[] = []
  const rows: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: Column count mismatch`)
      continue
    }

    const row: any = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ""
    })

    // Validate required fields
    if (!row.productcode && !row["product_code"]) {
      errors.push(`Row ${i + 1}: Product code is required`)
      continue
    }
    if (!row.name) {
      errors.push(`Row ${i + 1}: Product name is required`)
      continue
    }

    rows.push({
      productCode: row.productcode || row["product_code"] || "",
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 })
    }

    const fileContent = await file.text()
    const { rows, errors: parsingErrors } = parseCsv(fileContent)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV", parsingErrors },
        { status: 400 }
      )
    }

    // Fetch all categories for lookup
    const allCategories = await db.select().from(categories)
    const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c.id]))

    const validationErrors: Array<{ row: number; errors: string[] }> = []
    const importedProductIds: number[] = []
    let successfulRows = 0
    let failedRows = 0

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // +2 for header row and 1-based indexing
      const errors: string[] = []

      // Validate price if provided
      let basePrice = 0
      if (row.basePrice) {
        const parsedPrice = parseFloat(row.basePrice)
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          errors.push("Invalid price format")
        } else {
          basePrice = Math.round(parsedPrice * 100) // Convert to cents
        }
      } else {
        errors.push("Base price is required")
      }

      // Validate stock quantity
      let stockQuantity = 0
      if (row.stockQuantity) {
        const parsedStock = parseInt(row.stockQuantity)
        if (isNaN(parsedStock) || parsedStock < 0) {
          errors.push("Invalid stock quantity format (must be integer >= 0)")
        } else {
          stockQuantity = parsedStock
        }
      }

      // Lookup category
      let categoryId: number | null = null
      if (row.category) {
        categoryId = categoryMap.get(row.category.toLowerCase()) || null
        if (!categoryId) {
          errors.push(`Category "${row.category}" not found`)
        }
      }

      if (errors.length > 0) {
        validationErrors.push({ row: rowNumber, errors })
        failedRows++
        continue
      }

      try {
        // Check if product code already exists
        const existing = await db
          .select()
          .from(globalProducts)
          .where(eq(globalProducts.productCode, row.productCode.trim()))
          .limit(1)

        if (existing.length > 0) {
          // Update existing product and cascade changes
          const existingProduct = existing[0]

          const [updated] = await db
            .update(globalProducts)
            .set({
              name: row.name.trim(),
              description: row.description?.trim() || null,
              categoryId,
              imageUrl: row.imageUrl?.trim() || null,
              basePrice,
              unit: row.unit?.trim() || "unit",
              status: row.status?.toLowerCase() === "inactive" ? "inactive" : "active",
              stockQuantity,
              updatedAt: new Date(),
              lastSyncedAt: new Date(),
            })
            .where(eq(globalProducts.id, existing[0].id))
            .returning()

          // Cascade changes to organization inventory
          const updates = []
          if (existingProduct.name !== row.name.trim()) {
            updates.push({ field: 'name' as const, oldValue: existingProduct.name, newValue: row.name.trim() })
          }
          if (existingProduct.description !== (row.description?.trim() || null)) {
            updates.push({ field: 'description' as const, oldValue: existingProduct.description, newValue: row.description?.trim() || null })
          }
          if (existingProduct.imageUrl !== (row.imageUrl?.trim() || null)) {
            updates.push({ field: 'imageUrl' as const, oldValue: existingProduct.imageUrl, newValue: row.imageUrl?.trim() || null })
          }
          if (existingProduct.basePrice !== basePrice) {
            updates.push({ field: 'basePrice' as const, oldValue: existingProduct.basePrice, newValue: basePrice })
          }

          if (updates.length > 0) {
            await cascadeGlobalProductFieldUpdate(updated.id, updates, (session.user as any).id)
          }

          importedProductIds.push(updated.id)
        } else {
          // Create new product
          const [newProduct] = await db
            .insert(globalProducts)
            .values({
              productCode: row.productCode.trim(),
              name: row.name.trim(),
              description: row.description?.trim() || null,
              categoryId,
              imageUrl: row.imageUrl?.trim() || null,
              basePrice,
              unit: row.unit?.trim() || "unit",
              status: row.status?.toLowerCase() === "inactive" ? "inactive" : "active",
              stockQuantity,
              createdByUserId: (session.user as any).id,
              lastSyncedAt: new Date(),
            })
            .returning()

          importedProductIds.push(newProduct.id)
        }

        successfulRows++
      } catch (error: any) {
        validationErrors.push({ row: rowNumber, errors: [error.message] })
        failedRows++
      }
    }

    // Log audit
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      organizationId: null,
      branchId: null,
      action: "import_products",
      entity: "global_products",
      entityId: "bulk_import",
      metadata: { fileName: file.name, totalRows: rows.length, successfulRows, failedRows },
    })

    return NextResponse.json({
      message: `Successfully imported ${successfulRows} product(s)${failedRows > 0 ? `, ${failedRows} failed` : ""}`,
      imported: successfulRows,
      failed: failedRows,
      parsingErrors: parsingErrors.length > 0 ? parsingErrors : undefined,
      validationErrors: validationErrors.length > 0 ? validationErrors.slice(0, 50) : undefined, // Limit to first 50 errors
    })
  } catch (error: any) {
    console.error("Error importing products:", error)
    return NextResponse.json({ error: error.message || "Failed to import products" }, { status: 500 })
  }
}

