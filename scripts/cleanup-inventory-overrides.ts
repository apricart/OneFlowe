import { db } from "../lib/db";
import { organizationInventory, globalProducts } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function cleanupRedundantOverrides() {
    console.log("Cleaning up redundant overrides in organization_inventory...\n");

    try {
        // Clean up customName where it matches globalProducts.name
        console.log("Step 1: Finding redundant customName overrides...");
        const nameResults = await db.select({
            id: organizationInventory.id,
            globalProductId: organizationInventory.globalProductId,
            customName: organizationInventory.customName,
            globalName: globalProducts.name,
        })
            .from(organizationInventory)
            .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .where(
                and(
                    isNull(organizationInventory.deletedAt),
                    eq(organizationInventory.customName, globalProducts.name)
                )
            );

        console.log(`Found ${nameResults.length} redundant customName overrides.\n`);

        if (nameResults.length > 0) {
            console.log("Clearing redundant customName overrides...");
            const clearedNames = await db.update(organizationInventory)
                .set({ customName: null, updatedAt: new Date() })
                .where(
                    and(
                        isNull(organizationInventory.deletedAt),
                        eq(organizationInventory.customName, globalProducts.name)
                    )
                )
                .returning({ id: organizationInventory.id });

            console.log(`✓ Cleared ${clearedNames.length} customName overrides.\n`);
        }

        // Clean up customPrice where it matches globalProducts.basePrice
        console.log("Step 2: Finding redundant customPrice overrides...");
        const priceResults = await db.select({
            id: organizationInventory.id,
            globalProductId: organizationInventory.globalProductId,
            customPrice: organizationInventory.customPrice,
            basePrice: globalProducts.basePrice,
        })
            .from(organizationInventory)
            .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .where(
                and(
                    isNull(organizationInventory.deletedAt),
                    eq(organizationInventory.customPrice, globalProducts.basePrice)
                )
            );

        console.log(`Found ${priceResults.length} redundant customPrice overrides.\n`);

        if (priceResults.length > 0) {
            console.log("Clearing redundant customPrice overrides...");
            const clearedPrices = await db.update(organizationInventory)
                .set({ customPrice: null, updatedAt: new Date() })
                .where(
                    and(
                        isNull(organizationInventory.deletedAt),
                        eq(organizationInventory.customPrice, globalProducts.basePrice)
                    )
                )
                .returning({ id: organizationInventory.id });

            console.log(`✓ Cleared ${clearedPrices.length} customPrice overrides.\n`);
        }

        console.log("=".repeat(60));
        console.log("Summary:");
        console.log(`Total redundant customName cleared: ${nameResults.length}`);
        console.log(`Total redundant customPrice cleared: ${priceResults.length}`);
        console.log("=".repeat(60));
        console.log("\nCleanup completed successfully!");
        console.log("Future global product updates will now propagate correctly.\n");

    } catch (error) {
        console.error("\n❌ Cleanup failed:", error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

cleanupRedundantOverrides();
