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
import { and, eq, inArray } from "drizzle-orm";

dotenv.config({ path: ".env.local" });
dotenv.config();

const uploadedByUserId = "3c0d853b-1296-4b30-b68d-fd27696e9222";

const defaultCsvPath = "imports/ipak_products_upload_ready_comma.csv";
const csvPath = process.argv[2] || defaultCsvPath;
const defaultSubcategoryName = "General";

type CsvRow = {
  productCode?: string;
  name?: string;
  description?: string;
  parentCategoryId?: string;
  categoryId?: string;
  subcategoryId?: string;
  defaultSubcategoryName?: string;
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

type ImportRowError = { row: number; errors: string[] };

type CategoryRecord = {
  id: number;
  name: string;
  parentId: number | null;
  organizationId: number | null;
};

type ProductDraft = {
  productCode: string;
  name: string;
  description: string | null;
  parentCategoryId: number | null;
  subcategoryId: number | null;
  categoryIdFromLegacyColumn: boolean;
  defaultSubcategoryName: string;
  imageUrl: string | null;
  basePrice: number;
  discountType: string | null;
  discountValue: number | null;
  discountStartAt: Date | null;
  discountEndAt: Date | null;
  discountActive: boolean;
  unit: string;
  status: string;
  stockQuantity: number;
  metadata: Record<string, any>;
  createdByUserId: string;
  lastSyncedAt: Date | null;
  deletedAt: Date | null;
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
  const { categories, globalProducts, productImportBatches } = await import("../db/schema");

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

  const validationErrors: ImportRowError[] = [];
  const validProducts: ProductDraft[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because CSV header is row 1
    const errors: string[] = [];

    const productCode = clean(row.productCode);
    const name = clean(row.name);
    const basePrice = requiredInteger(row.basePrice);
    const unit = clean(row.unit);
    const status = clean(row.status) || "active";
    const rawParentCategoryId = clean(row.parentCategoryId);
    const rawSubcategoryId = clean(row.subcategoryId);
    const rawLegacyCategoryId = clean(row.categoryId);
    const categoryIdFromLegacyColumn =
      !rawParentCategoryId && !rawSubcategoryId && Boolean(rawLegacyCategoryId);

    const parentCategoryId = rawParentCategoryId
      ? nullableInteger(rawParentCategoryId)
      : rawSubcategoryId
        ? null
        : nullableInteger(rawLegacyCategoryId);
    const subcategoryId = rawSubcategoryId
      ? nullableInteger(rawSubcategoryId)
      : null;

    if (!productCode) errors.push("productCode is required");
    if (!name) errors.push("name is required");
    if (basePrice === null) errors.push("basePrice is required and must be a number");
    if (!unit) errors.push("unit is required");
    if (rawParentCategoryId && parentCategoryId === null) {
      errors.push("parentCategoryId must be a number");
    }
    if (rawSubcategoryId && subcategoryId === null) {
      errors.push("subcategoryId must be a number");
    }
    if (categoryIdFromLegacyColumn && parentCategoryId === null) {
      errors.push("categoryId must be a number");
    }

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
      parentCategoryId,
      subcategoryId,
      categoryIdFromLegacyColumn,
      defaultSubcategoryName: clean(row.defaultSubcategoryName) || defaultSubcategoryName,
      imageUrl: nullableString(row.imageUrl),

      // Important:
      // The upload-ready CSV already contains basePrice in cents/paisa.
      // Do NOT multiply it by 100 again here.
      basePrice: basePrice ?? 0,

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

    let duplicateErrors: ImportRowError[] = [];
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

    const categoryErrors: ImportRowError[] = [];
    const resolvedProducts: any[] = [];
    const defaultSubcategoryIds = new Map<string, number>();
    const categoryIds = Array.from(
      new Set(
        productsToInsert
          .flatMap((product) => [product.parentCategoryId, product.subcategoryId])
          .filter((id): id is number => id !== null)
      )
    );
    const categoryRows: CategoryRecord[] = categoryIds.length
      ? await tx
          .select({
            id: categories.id,
            name: categories.name,
            parentId: categories.parentId,
            organizationId: categories.organizationId,
          })
          .from(categories)
          .where(inArray(categories.id, categoryIds))
      : [];
    const categoryById = new Map<number, CategoryRecord>(
      categoryRows.map((category) => [category.id, category])
    );

    for (const product of productsToInsert) {
      const rowErrors: string[] = [];
      let resolvedCategoryId: number | null = null;
      let resolvedParentCategoryId = product.parentCategoryId;

      if (product.subcategoryId !== null) {
        const subcategory = categoryById.get(product.subcategoryId);

        if (!subcategory) {
          rowErrors.push(`subcategoryId does not exist: ${product.subcategoryId}`);
        } else if (subcategory.parentId === null || subcategory.parentId === undefined) {
          rowErrors.push(
            `subcategoryId ${product.subcategoryId} is a parent category; expected a subcategory`
          );
        } else if (
          product.parentCategoryId !== null &&
          product.parentCategoryId !== subcategory.parentId
        ) {
          rowErrors.push(
            `subcategoryId ${product.subcategoryId} does not belong to parentCategoryId ${product.parentCategoryId}`
          );
        } else {
          resolvedCategoryId = subcategory.id;
          resolvedParentCategoryId = subcategory.parentId;
        }
      } else if (product.parentCategoryId !== null) {
        const parentCategory = categoryById.get(product.parentCategoryId);

        if (!parentCategory) {
          rowErrors.push(`parentCategoryId does not exist: ${product.parentCategoryId}`);
        } else if (
          product.categoryIdFromLegacyColumn &&
          parentCategory.parentId !== null &&
          parentCategory.parentId !== undefined
        ) {
          resolvedCategoryId = parentCategory.id;
          resolvedParentCategoryId = parentCategory.parentId;
        } else if (parentCategory.parentId !== null && parentCategory.parentId !== undefined) {
          rowErrors.push(
            `parentCategoryId ${product.parentCategoryId} is a subcategory; use a parent category id or put it in subcategoryId`
          );
        } else {
          const subcategoryName = product.defaultSubcategoryName || defaultSubcategoryName;
          const subcategoryKey = `${parentCategory.id}:${subcategoryName.toLowerCase()}`;
          let defaultSubcategoryId = defaultSubcategoryIds.get(subcategoryKey) ?? null;

          if (!defaultSubcategoryId) {
            const [existingSubcategory] = await tx
              .select({ id: categories.id })
              .from(categories)
              .where(
                and(
                  eq(categories.parentId, parentCategory.id),
                  eq(categories.name, subcategoryName)
                )
              )
              .limit(1);

            if (existingSubcategory) {
              defaultSubcategoryId = existingSubcategory.id;
            } else {
              const [createdSubcategory] = await tx
                .insert(categories)
                .values({
                  name: subcategoryName,
                  parentId: parentCategory.id,
                  organizationId: parentCategory.organizationId,
                })
                .returning({ id: categories.id });

              defaultSubcategoryId = createdSubcategory.id;
            }

            if (defaultSubcategoryId === null) {
              throw new Error(
                `Could not resolve default subcategory for parentCategoryId ${parentCategory.id}`
              );
            }

            defaultSubcategoryIds.set(subcategoryKey, defaultSubcategoryId);
          }

          resolvedCategoryId = defaultSubcategoryId;
        }
      }

      if (rowErrors.length) {
        categoryErrors.push({
          row: Number(product.metadata?.originalCsvRow || 0),
          errors: rowErrors,
        });
        continue;
      }

      const {
        parentCategoryId: _parentCategoryId,
        subcategoryId: _subcategoryId,
        categoryIdFromLegacyColumn: _categoryIdFromLegacyColumn,
        defaultSubcategoryName: _defaultSubcategoryName,
        ...insertProduct
      } = product;

      resolvedProducts.push({
        ...insertProduct,
        categoryId: resolvedCategoryId,
        metadata: {
          ...insertProduct.metadata,
          ...(resolvedParentCategoryId !== null
            ? { parentCategoryId: resolvedParentCategoryId }
            : {}),
          ...(resolvedCategoryId !== null ? { resolvedSubcategoryId: resolvedCategoryId } : {}),
        },
      });
    }

    const insertedProducts = resolvedProducts.length
      ? await tx
          .insert(globalProducts)
          .values(resolvedProducts)
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

    const allErrors = [...validationErrors, ...duplicateErrors, ...categoryErrors];
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
