import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "../lib/db"
import { branches as branchesTable } from "../db/schema"
import { desc } from "drizzle-orm"

async function testQuery() {
    try {
        console.log("🧪 Testing branches query...")
        const items = await db
            .select()
            .from(branchesTable)
            .orderBy(desc(branchesTable.createdAt))

        console.log(`✅ Success! Found ${items.length} branches.`)
        process.exit(0)
    } catch (e: any) {
        console.error("❌ Query failed:", e.message)
        console.error("Full error:", e)
        process.exit(1)
    }
}

testQuery()
