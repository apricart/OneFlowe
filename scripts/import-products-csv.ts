#!/usr/bin/env tsx

/**
 * Bulk product import from CSV
 *
 * Usage:
 * npm run import:products-csv
 *
 * Optional:
 * tsx scripts/import-products-csv.ts imports/ipak_products_upload_ready_comma.csv
 */

import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse } from "csv-parse/sync";
import { eq, inArray } from "drizzle-orm";

dotenv.config({ path: ".env.local" });
dotenv.config();

const uploadedByUserId = "33ac5154-29dc-4cc3-9f1e-bef288bafa71";

const defaultCsvPath = "imports/ipak_products_upload_ready_comma.csv";
const csvPath = process.argv[2] || defaultCsvPath;

type CsvRow = {
  productCode?: string;
  name?: string;
  description?: string;
  categoryId?: string;
  imageUrl?: string;
  basePrice?: string;
  discountType?: string;
  discountValue?: string;
  discountStartAt?: string;
  discountEndAt?: string;
  discountActive?: string;
  unit?: string;
  status?: string;
  stockQuantity?: string;
  metadata?: string;
  createdByUserId?: string;
  lastSyncedAt?: string;
  deletedAt?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableString(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned ? cleaned : null;
}

function nullableInteger(value: unknown): number | null {
  const cleaned = clean(value);

  if (!cleaned) return null;

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function requiredInteger(value: unknown): number | null {
  const parsed = nullableInteger(value);
  return parsed;
}

function nullableDate(value: unknown): Date | null {
  const cleaned = clean(value);

  if (!cleaned) return null;

  const parsed = new Date(cleaned);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseBoolean(value: unknown): boolean {
  const cleaned = clean(value).toLowerCase();

  if (!cleaned) return false;

  return ["true", "1", "yes", "y", "active"].includes(cleaned);
}

function parseMetadata(value: unknown, fallback: Record<string, any>) {
  const cleaned = clean(value);

  if (!cleaned) return fallback;

  try {
    return {
      ...JSON.parse(cleaned),
      ...fallback,
    };
  } catch {
    return {
      ...fallback,
      rawMetadata: cleaned,
    };
  }
}

async function main() {
  const { db } = await import("../lib/db");
  const { globalProducts, productImportBatches } = await import("../db/schema");

  const absoluteCsvPath = resolve(process.cwd(), csvPath);

  console.log("📄 Reading CSV file:");
  console.log(absoluteCsvPath);

  const csvContent = readFileSync(absoluteCsvPath, "utf-8");

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CsvRow[];

  if (!rows.length) {
    console.error("❌ CSV file has no rows.");
    process.exit(1);
  }

  const validationErrors: Array<{ row: number; errors: string[] }> = [];
  const validProducts: any[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because CSV header is row 1
    const errors: string[] = [];

    const productCode = clean(row.productCode);
    const name = clean(row.name);
    const basePrice = requiredInteger(row.basePrice);
    const unit = clean(row.unit);
    const status = clean(row.status) || "active";

    if (!productCode) errors.push("productCode is required");
    if (!name) errors.push("name is required");
    if (basePrice === null) errors.push("basePrice is required and must be a number");
    if (!unit) errors.push("unit is required");

    const categoryId = nullableInteger(row.categoryId);
    const discountValue = nullableInteger(row.discountValue);
    const stockQuantity = nullableInteger(row.stockQuantity);

    const discountStartAt = nullableDate(row.discountStartAt);
    const discountEndAt = nullableDate(row.discountEndAt);
    const lastSyncedAt = nullableDate(row.lastSyncedAt);
    const deletedAt = nullableDate(row.deletedAt);

    if (errors.length) {
      validationErrors.push({
        row: rowNumber,
        errors,
      });
      return;
    }

    validProducts.push({
      productCode,
      name,
      description: nullableString(row.description),
      categoryId,
      imageUrl: nullableString(row.imageUrl),

      // Important:
      // The upload-ready CSV already contains basePrice in cents/paisa.
      // Do NOT multiply it by 100 again here.
      basePrice,

      discountType: nullableString(row.discountType),
      discountValue,
      discountStartAt,
      discountEndAt,
      discountActive: parseBoolean(row.discountActive),

      unit,
      status,
      stockQuantity: stockQuantity ?? 0,

      metadata: parseMetadata(row.metadata, {
        importedFrom: "csv-bulk-upload",
        sourceFile: csvPath,
        originalCsvRow: rowNumber,
      }),

      createdByUserId: clean(row.createdByUserId) || uploadedByUserId,
      lastSyncedAt,
      deletedAt,
    });
  });

  const productCodes = validProducts.map((product) => product.productCode);

  const result = await db.transaction(async (tx: any) => {
    const [batch] = await tx
      .insert(productImportBatches)
      .values({
        fileName: csvPath.split(/[\\/]/).pop() || "products.csv",
        uploadedByUserId,
        totalRows: rows.length,
        successfulRows: 0,
        failedRows: 0,
        status: "processing",
        validationErrors,
        importedProductIds: [],
        metadata: {
          type: "csv-product-import",
          sourceFile: csvPath,
        },
      })
      .returning();

    let duplicateErrors: Array<{ row: number; errors: string[] }> = [];
    let productsToInsert = validProducts;

    if (productCodes.length) {
      const existingProducts = await tx
        .select({
          productCode: globalProducts.productCode,
        })
        .from(globalProducts)
        .where(inArray(globalProducts.productCode, productCodes));

      const existingProductCodes = new Set(
        existingProducts.map((product: any) => product.productCode)
      );

      productsToInsert = validProducts.filter((product) => {
        return !existingProductCodes.has(product.productCode);
      });

      duplicateErrors = validProducts
        .filter((product) => existingProductCodes.has(product.productCode))
        .map((product) => ({
          row: Number(product.metadata?.originalCsvRow || 0),
          errors: [`Duplicate productCode already exists: ${product.productCode}`],
        }));
    }

    const insertedProducts = productsToInsert.length
      ? await tx
          .insert(globalProducts)
          .values(productsToInsert)
          .returning({
            id: globalProducts.id,
            productCode: globalProducts.productCode,
            name: globalProducts.name,
            basePrice: globalProducts.basePrice,
            unit: globalProducts.unit,
            stockQuantity: globalProducts.stockQuantity,
            status: globalProducts.status,
          })
      : [];

    const allErrors = [...validationErrors, ...duplicateErrors];
    const failedRows = allErrors.length;
    const successfulRows = insertedProducts.length;

    await tx
      .update(productImportBatches)
      .set({
        successfulRows,
        failedRows,
        status:
          failedRows === 0
            ? "completed"
            : successfulRows > 0
              ? "partial"
              : "failed",
        validationErrors: allErrors,
        importedProductIds: insertedProducts.map((product: any) => product.id),
        completedAt: new Date(),
      })
      .where(eq(productImportBatches.id, batch.id));

    return {
      batchId: batch.id,
      totalRows: rows.length,
      validRows: validProducts.length,
      insertedRows: insertedProducts.length,
      failedRows,
      skippedDuplicateRows: duplicateErrors.length,
      insertedProducts,
      errors: allErrors,
    };
  });

  console.log("✅ CSV product import finished:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("❌ CSV product import failed:");
  console.error(error);
  process.exit(1);
});