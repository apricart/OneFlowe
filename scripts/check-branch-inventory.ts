import { db } from "../lib/db"
import { branchInventory } from "../db/schema"
import { sql } from "drizzle-orm"

async function checkBranchInventory() {
    try {
        const result = await db.select({ count: sql<number>`count(*)` }).from(branchInventory)
        console.log("Branch inventory count:", result[0].count)

        // Get first 5 records to see structure
        const samples = await db.select().from(branchInventory).limit(5)
        console.log("Sample records:", JSON.stringify(samples, null, 2))
    } catch (e) {
        console.error("Error:", e)
    }
    process.exit()
}

checkBranchInventory()
