
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../lib/db";
import { organizationInventory, globalProducts } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";

async function run() {
    try {
        const organizationId = 1;
        const query = db.select({
            id: organizationInventory.id,
            name: globalProducts.name,
            status: globalProducts.status
        })
            .from(organizationInventory)
            .leftJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .where(and(
                eq(organizationInventory.organizationId, organizationId),
                isNull(organizationInventory.deletedAt),
                isNull(globalProducts.deletedAt),
                eq(globalProducts.status, "active")
            ));

        console.log("--- Generated SQL ---");
        console.log(query.toSQL().sql);
        console.log("Params:", query.toSQL().params);

        const items = await query;
        console.log("\n--- Query Result ---");
        console.table(items);

        process.exit(0);
    } catch (e: any) {
        console.error("Error:", e.message);
        process.exit(1);
    }
}

run();
