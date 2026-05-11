#!/usr/bin/env tsx

/**
 * Fake bulk product import test
 * Usage:
 * npm run import:fake-products
 */

import * as dotenv from "dotenv";
import { eq, inArray } from "drizzle-orm";

// Load .env.local first, then .env as fallback
dotenv.config({ path: ".env.local" });
dotenv.config();

const uploadedByUserId = "33ac5154-29dc-4cc3-9f1e-bef288bafa71";

async function main() {
  // Import db and schema AFTER dotenv is loaded
  const { db } = await import("../lib/db");
  const { globalProducts, productImportBatches } = await import("../db/schema");

  const fakeProducts = [
    {
      productCode: "TEST-RICE-003",
      name: "Test Basmati Rice",
      description: "Fake test product for bulk upload testing",
      imageUrl: "https://example.com/rice.jpg",
      basePrice: 120000,
      unit: "kg",
      status: "active",
      stockQuantity: 50,
      createdByUserId: uploadedByUserId,
      metadata: {
        source: "fake-bulk-import-test",
      },
    },
    {
      productCode: "TEST-OIL-004",
      name: "Test Cooking Oil",
      description: "Second fake test product for bulk upload testing",
      imageUrl: "https://example.com/oil.jpg",
      basePrice: 250000,
      unit: "liter",
      status: "active",
      stockQuantity: 30,
      createdByUserId: uploadedByUserId,
      metadata: {
        source: "fake-bulk-import-test",
      },
    },
  ];

  const productCodes = fakeProducts.map((product) => product.productCode);

  const result = await db.transaction(async (tx: any) => {
    // Delete old test products so you can run this script multiple times
    await tx
      .delete(globalProducts)
      .where(inArray(globalProducts.productCode, productCodes));

    // Create import batch record
    const [batch] = await tx
      .insert(productImportBatches)
      .values({
        fileName: "fake-products-test.csv",
        uploadedByUserId,
        totalRows: fakeProducts.length,
        successfulRows: 0,
        failedRows: 0,
        status: "processing",
        validationErrors: [],
        importedProductIds: [],
        metadata: {
          type: "manual-fake-test",
        },
      })
      .returning();

    // Insert fake products
    const insertedProducts = await tx
      .insert(globalProducts)
      .values(fakeProducts)
      .returning({
        id: globalProducts.id,
        productCode: globalProducts.productCode,
        name: globalProducts.name,
      });

    // Update batch after successful insert
    await tx
      .update(productImportBatches)
      .set({
        successfulRows: insertedProducts.length,
        failedRows: 0,
        status: "completed",
        importedProductIds: insertedProducts.map((product: any) => product.id),
        completedAt: new Date(),
      })
      .where(eq(productImportBatches.id, batch.id));

    return {
      batchId: batch.id,
      insertedProducts,
    };
  });

  console.log("✅ Fake product import completed successfully:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("❌ Fake product import failed:");
  console.error(error);
  process.exit(1);
});