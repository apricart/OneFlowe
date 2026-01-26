import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "../lib/db"
import { branchInventory, organizationInventory, globalProducts, categories } from "../db/schema"
import { and, eq, or, isNull, sql, desc } from "drizzle-orm"

async function testQuery() {
    try {
        console.log("🧪 Testing Branch Inventory query with visibility filter...")

        const orgIdNum = 1 // Assuming 1 exists
        const branchId = 1 // Assuming 1 exists
        const search = ""
        const visibility = "visible"

        const conditions = [
            eq(organizationInventory.organizationId, orgIdNum),
            isNull(organizationInventory.deletedAt),
        ]

        if (visibility === "visible") {
            conditions.push(
                or(
                    eq(branchInventory.isVisible, true),
                    isNull(branchInventory.id)
                )
            )
        }

        const whereClause = and(...(conditions.filter(Boolean) as any))

        const items = await db.select({
            id: sql<number>`COALESCE(${branchInventory.id}, ${organizationInventory.id})`,
            isVisible: sql<boolean>`COALESCE(${branchInventory.isVisible}, true)`,
        })
            .from(organizationInventory)
            .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .leftJoin(
                branchInventory,
                and(
                    eq(branchInventory.organizationInventoryId, organizationInventory.id),
                    branchId ? eq(branchInventory.branchId, branchId) : sql`FALSE`,
                    isNull(branchInventory.deletedAt),
                )
            )
            .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
            .where(whereClause)
            .orderBy(desc(organizationInventory.id))
            .limit(10)

        console.log(`✅ Success! Found ${items.length} items.`)
        process.exit(0)
    } catch (e: any) {
        console.error("❌ Query failed:", e.message)
        console.error("Full error:", e)
        process.exit(1)
    }
}

testQuery()
