import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin } from "@/lib/db"
import { globalProducts, productImportBatches, auditLogs, categories } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

interface CSVRow {
  productCode: string
  name: string
  description?: string
  category?: string
  imageUrl?: string
  basePrice?: string
  unit?: string
  status?: string
}

// POST /api/v1/inventory/import - Import products from CSV
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { fileName, rows } = body

    if (!fileName || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid import data" }, { status: 400 })
    }

    const MAX_IMPORT_ROWS = 1000
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json({ error: `Import payload too large. Maximum ${MAX_IMPORT_ROWS} rows allowed.` }, { status: 400 })
    }

    const result = await withSuperAdmin(async (tx: any) => {
      // 1. Create import batch record
      const [batch] = await tx.insert(productImportBatches).values({
        fileName,
        uploadedByUserId: user.id,
        totalRows: rows.length,
        status: "processing"
      }).returning()

      // 2. Fetch all categories for lookup
      const allCategories = await tx.select().from(categories)
      const categoryMap = new Map(allCategories.map((c: any) => [c.name.toLowerCase(), c.id]))

      const validationErrors: Array<{ row: number; errors: string[] }> = []
      const importedProductIds: number[] = []
      let successfulRows = 0
      let failedRows = 0

      // 3. Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as CSVRow
        const rowNumber = i + 2
        const errors: string[] = []

        if (!row.productCode?.trim()) errors.push("Product code is required")
        if (!row.name?.trim()) errors.push("Product name is required")

        let basePrice = 0
        if (row.basePrice) {
          const parsedPrice = parseFloat(row.basePrice)
          if (isNaN(parsedPrice) || parsedPrice < 0) errors.push("Invalid price format")
          else basePrice = Math.round(parsedPrice * 100)
        }

        let categoryId: number | null = null
        if (row.category) {
          const foundId = categoryMap.get(row.category.toLowerCase())
          categoryId = foundId ? (foundId as number) : null
          if (!categoryId) errors.push(`Category "${row.category}" not found`)
        }

        if (errors.length > 0) {
          validationErrors.push({ row: rowNumber, errors })
          failedRows++
          continue
        }

        try {
          const [existing] = await tx.select().from(globalProducts).where(eq(globalProducts.productCode, row.productCode.trim())).limit(1)

          let productId: number
          if (existing) {
            const [updated] = await tx.update(globalProducts).set({
              name: row.name.trim(),
              description: row.description?.trim() || null,
              categoryId,
              imageUrl: row.imageUrl?.trim() || null,
              basePrice,
              unit: row.unit?.trim() || "unit",
              status: row.status?.toLowerCase() === "inactive" ? "inactive" : "active",
              updatedAt: new Date(),
              lastSyncedAt: new Date()
            }).where(eq(globalProducts.id, existing.id)).returning()
            productId = updated.id
          } else {
            const [newProduct] = await tx.insert(globalProducts).values({
              productCode: row.productCode.trim(),
              name: row.name.trim(),
              description: row.description?.trim() || null,
              categoryId,
              imageUrl: row.imageUrl?.trim() || null,
              basePrice,
              unit: row.unit?.trim() || "unit",
              status: row.status?.toLowerCase() === "inactive" ? "inactive" : "active",
              createdByUserId: user.id,
              lastSyncedAt: new Date()
            }).returning()
            productId = newProduct.id
          }
          importedProductIds.push(productId)
          successfulRows++
        } catch (error: any) {
          validationErrors.push({ row: rowNumber, errors: [error.message] })
          failedRows++
        }
      }

      // 4. Update batch status
      const batchStatus = failedRows === 0 ? "completed" : (successfulRows === 0 ? "failed" : "partial")
      await tx.update(productImportBatches).set({
        successfulRows,
        failedRows,
        status: batchStatus,
        validationErrors,
        importedProductIds,
        completedAt: new Date()
      }).where(eq(productImportBatches.id, batch.id))

      // 5. Log audit
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "import_products",
        entity: "global_products",
        entityId: batch.id.toString(),
        metadata: { fileName, totalRows: rows.length, successfulRows, failedRows }
      })

      return {
        batchId: batch.id,
        summary: { total: rows.length, successful: successfulRows, failed: failedRows, status: batchStatus },
        validationErrors: validationErrors.slice(0, 50),
        importedProductIds
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error importing products:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// GET /api/v1/inventory/import - List or get import batch status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    const { searchParams } = new URL(req.url)
    const batchId = searchParams.get("batchId")

    const result = await withSuperAdmin(async (tx: any) => {
      if (batchId) {
        const [batch] = await tx.select().from(productImportBatches).where(eq(productImportBatches.id, parseInt(batchId))).limit(1)
        return batch
      }

      return tx.select().from(productImportBatches).where(eq(productImportBatches.uploadedByUserId, user.id)).orderBy(sql`created_at DESC`).limit(20)
    })

    if (batchId && !result) return NextResponse.json({ error: "Batch not found" }, { status: 404 })

    return NextResponse.json(batchId ? { batch: result } : { batches: result })
  } catch (error: any) {
    console.error("Error fetching import batch:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}



