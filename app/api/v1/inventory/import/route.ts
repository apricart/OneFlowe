import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Super Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { fileName, rows } = body

    if (!fileName || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid import data" }, { status: 400 })
    }

    // Security: Limit number of rows to prevent DoS/Memory issues
    const MAX_IMPORT_ROWS = 1000
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json({
        error: `Import payload too large. Maximum ${MAX_IMPORT_ROWS} rows allowed per batch.`
      }, { status: 400 })
    }

    // Create import batch record
    const [batch] = await db.insert(productImportBatches).values({
      fileName,
      uploadedByUserId: (session.user as any).id,
      totalRows: rows.length,
      status: "processing"
    }).returning()

    const validationErrors: Array<{ row: number; errors: string[] }> = []
    const importedProductIds: number[] = []
    let successfulRows = 0
    let failedRows = 0

    // Fetch all categories for lookup
    const allCategories = await db.select().from(categories)
    const categoryMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c.id]))

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as CSVRow
      const rowNumber = i + 2 // +2 for header row and 1-based indexing
      const errors: string[] = []

      // Validate required fields
      if (!row.productCode || !row.productCode.trim()) {
        errors.push("Product code is required")
      }
      if (!row.name || !row.name.trim()) {
        errors.push("Product name is required")
      }

      // Validate price if provided
      let basePrice = 0
      if (row.basePrice) {
        const parsedPrice = parseFloat(row.basePrice)
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          errors.push("Invalid price format")
        } else {
          basePrice = Math.round(parsedPrice * 100) // Convert to cents
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
        const existing = await db.select()
          .from(globalProducts)
          .where(eq(globalProducts.productCode, row.productCode.trim()))
          .limit(1)

        if (existing.length > 0) {
          // Update existing product
          const [updated] = await db.update(globalProducts)
            .set({
              name: row.name.trim(),
              description: row.description?.trim() || null,
              categoryId,
              imageUrl: row.imageUrl?.trim() || null,
              basePrice,
              unit: row.unit?.trim() || "unit",
              status: row.status?.toLowerCase() === "inactive" ? "inactive" : "active",
              updatedAt: new Date(),
              lastSyncedAt: new Date()
            })
            .where(eq(globalProducts.id, existing[0].id))
            .returning()

          importedProductIds.push(updated.id)
        } else {
          // Create new product
          const [newProduct] = await db.insert(globalProducts).values({
            productCode: row.productCode.trim(),
            name: row.name.trim(),
            description: row.description?.trim() || null,
            categoryId,
            imageUrl: row.imageUrl?.trim() || null,
            basePrice,
            unit: row.unit?.trim() || "unit",
            status: row.status?.toLowerCase() === "inactive" ? "inactive" : "active",
            createdByUserId: (session.user as any).id,
            lastSyncedAt: new Date()
          }).returning()

          importedProductIds.push(newProduct.id)
        }

        successfulRows++
      } catch (error: any) {
        validationErrors.push({ row: rowNumber, errors: [error.message] })
        failedRows++
      }
    }

    // Update batch status
    const batchStatus = failedRows === 0 ? "completed" : (successfulRows === 0 ? "failed" : "partial")

    await db.update(productImportBatches)
      .set({
        successfulRows,
        failedRows,
        status: batchStatus,
        validationErrors,
        importedProductIds,
        completedAt: new Date()
      })
      .where(eq(productImportBatches.id, batch.id))

    // Log audit
    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      organizationId: null,
      branchId: null,
      action: "import_products",
      entity: "global_products",
      entityId: batch.id.toString(),
      metadata: { fileName, totalRows: rows.length, successfulRows, failedRows }
    })

    return NextResponse.json({
      batchId: batch.id,
      summary: {
        total: rows.length,
        successful: successfulRows,
        failed: failedRows,
        status: batchStatus
      },
      validationErrors: validationErrors.length > 0 ? validationErrors.slice(0, 50) : [], // Limit to first 50 errors
      importedProductIds
    })
  } catch (error: any) {
    console.error("Error importing products:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// GET /api/v1/inventory/import/[batchId] - Get import batch status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const batchId = searchParams.get("batchId")

    if (!batchId) {
      // List recent batches
      const batches = await db.select()
        .from(productImportBatches)
        .where(eq(productImportBatches.uploadedByUserId, (session.user as any).id))
        .orderBy(sql`created_at DESC`)
        .limit(20)

      return NextResponse.json({ batches })
    }

    // Get specific batch
    const [batch] = await db.select()
      .from(productImportBatches)
      .where(eq(productImportBatches.id, parseInt(batchId)))
      .limit(1)

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    return NextResponse.json({ batch })
  } catch (error: any) {
    console.error("Error fetching import batch:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

