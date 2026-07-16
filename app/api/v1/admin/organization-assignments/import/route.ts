"use server"

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { globalProducts, organizationInventory, auditLogs } from "@/db/schema"
import { eq, inArray, and, isNull } from "drizzle-orm"

type ParsedRow = {
  productCode: string
  customPrice?: number | null
  customName?: string | null
  customDescription?: string | null
  isActive?: boolean
}

const REQUIRED_HEADERS = ["productcode"]

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    throw new Error("CSV file is empty")
  }

  const headers = lines
    .shift()!
    .split(",")
    .map((header) => header.trim().toLowerCase())

  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header)
  )
  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required headers: ${missingHeaders.join(", ")}`
    )
  }

  const headerIndex = (name: string) =>
    headers.indexOf(name.toLowerCase())

  const rows: ParsedRow[] = []
  const errors: string[] = []

  lines.forEach((line, index) => {
    const cols = line.split(",").map((col) => col.trim())
    const rowNumber = index + 2 // account for header line
    const productCodeIdx = headerIndex("productcode")
    const customPriceIdx = headerIndex("customprice")
    const customNameIdx = headerIndex("customname")
    const customDescriptionIdx = headerIndex("customdescription")
    const isActiveIdx = headerIndex("isactive")

    if (productCodeIdx === -1) {
      return
    }

    const productCode = cols[productCodeIdx]
    if (!productCode) {
      errors.push(`Row ${rowNumber}: productCode is required`)
      return
    }

    const parsedRow: ParsedRow = {
      productCode: productCode.toUpperCase(),
    }

    if (customPriceIdx !== -1) {
      const priceValue = cols[customPriceIdx]
      if (priceValue) {
        const parsedPrice = Number(priceValue)
        if (Number.isNaN(parsedPrice)) {
          errors.push(`Row ${rowNumber}: invalid customPrice "${priceValue}"`)
        } else {
          parsedRow.customPrice = Math.round(parsedPrice * 100)
        }
      }
    }

    if (customNameIdx !== -1) {
      parsedRow.customName = cols[customNameIdx] || null
    }

    if (customDescriptionIdx !== -1) {
      parsedRow.customDescription = cols[customDescriptionIdx] || null
    }

    if (isActiveIdx !== -1) {
      const value = cols[isActiveIdx]?.toLowerCase()
      if (value === "true" || value === "1") {
        parsedRow.isActive = true
      } else if (value === "false" || value === "0") {
        parsedRow.isActive = false
      }
    }

    rows.push(parsedRow)
  })

  return { rows, errors }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if ((session.user as any).role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file")
    const organizationIdValue = formData.get("organizationId")
    const isActiveValue = formData.get("isActive")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 })
    }

    if (!organizationIdValue) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 })
    }

    const organizationId = parseInt(String(organizationIdValue))
    if (!Number.isFinite(organizationId)) {
      return NextResponse.json({ error: "Invalid organizationId" }, { status: 400 })
    }

    const defaultIsActive =
      typeof isActiveValue === "string"
        ? !(isActiveValue.toLowerCase() === "false" || isActiveValue === "0")
        : true

    const fileContent = await file.text()
    const { rows, errors: parsingErrors } = parseCsv(fileContent)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV", details: parsingErrors },
        { status: 400 }
      )
    }

    const productCodes = Array.from(new Set(rows.map((row) => row.productCode)))
    const products = await db
      .select({
        id: globalProducts.id,
        productCode: globalProducts.productCode,
      })
      .from(globalProducts)
      .where(inArray(globalProducts.productCode, productCodes))

    const productMap = new Map(products.map((product) => [product.productCode.toUpperCase(), product]))
    const missingProducts = productCodes.filter((code) => !productMap.has(code))

    const validRows = rows.filter((row) => productMap.has(row.productCode))
    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "No matching products found for provided codes", missingProducts, parsingErrors },
        { status: 400 }
      )
    }

    const productIds = validRows.map((row) => productMap.get(row.productCode)!.id)
    const existingAssignments = await db
      .select({
        globalProductId: organizationInventory.globalProductId,
      })
      .from(organizationInventory)
      .where(
        and(
          eq(organizationInventory.organizationId, organizationId),
          inArray(organizationInventory.globalProductId, productIds),
          isNull(organizationInventory.deletedAt)
        )
      )

    const existingProductIds = new Set(existingAssignments.map((assignment) => assignment.globalProductId))
    const assignmentsToInsert = validRows
      .filter((row) => {
        const product = productMap.get(row.productCode)
        return product && !existingProductIds.has(product.id)
      })
      .map((row) => {
        const product = productMap.get(row.productCode)!
        return {
          globalProductId: product.id,
          organizationId,
          assignedByUserId: (session.user as any).id,
          isActive: row.isActive ?? defaultIsActive,
          customName: row.customName ?? null,
          customPrice: typeof row.customPrice === "number" ? row.customPrice : null,
          customDescription: row.customDescription ?? null,
          customImageUrl: null,
        }
      })

    if (assignmentsToInsert.length === 0) {
      return NextResponse.json({
        error: "All products in CSV are already assigned to this organization",
        missingProducts,
        parsingErrors,
        alreadyAssigned: Array.from(existingProductIds),
      }, { status: 400 })
    }

    const inserted = await db
      .insert(organizationInventory)
      .values(assignmentsToInsert)
      .returning()

    await db.insert(auditLogs).values({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "OrganizationAssignmentImport",
      entityId: inserted.map((row) => row.id).join(","),
      metadata: {
        organizationId,
        importedCount: inserted.length,
        skippedCount: existingProductIds.size,
        missingProducts,
      },
    })

    return NextResponse.json({
      message: `Imported ${inserted.length} products successfully`,
      imported: inserted.length,
      skippedExisting: existingProductIds.size,
      missingProducts,
      parsingErrors,
    })
  } catch (error: any) {
    console.error("Error importing assignments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

