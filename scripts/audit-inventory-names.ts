import { db } from "../lib/db";
import { organizationInventory, globalProducts } from "../db/schema";
import { eq, isNotNull, and, isNull } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function auditRedundantNames() {
    console.log("Auditing organization_inventory for redundant names...");

    try {
        const results = await db.select({
            id: organizationInventory.id,
            globalProductId: organizationInventory.globalProductId,
            customName: organizationInventory.customName,
            globalName: globalProducts.name,
        })
            .from(organizationInventory)
            .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .where(
                and(
                    isNotNull(organizationInventory.customName),
                    isNull(organizationInventory.deletedAt)
                )
            );

        console.log(`Found ${results.length} items with custom names.`);

        let redundantCount = 0;
        results.forEach(item => {
            if (item.customName === item.globalName) {
                redundantCount++;
                // console.log(`[REDUNDANT] ID: ${item.id}, Name: "${item.globalName}"`);
            } else {
                // console.log(`[INTENTIONAL] ID: ${item.id}, Global: "${item.globalName}", Custom: "${item.customName}"`);
            }
        });

        console.log(`Summary:`);
        console.log(`Total active items with custom names: ${results.length}`);
        console.log(`Redundant items (custom === global): ${redundantCount}`);

    } catch (error) {
        console.error("Audit failed:", error);
    } finally {
        process.exit(0);
    }
}

auditRedundantNames();
