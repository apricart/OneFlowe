import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "../lib/db"
import { branches as branchesTable } from "../db/schema"
import { and, desc, eq } from "drizzle-orm"

async function testQuery() {
    try {
        console.log("🧪 Testing branches query with filters...")

        // Simulate what might happen in the API
        const scopedOrgId = undefined
        const scopedBranchId = undefined

        const items = await db
            .select()
            .from(branchesTable)
            .where(and(
                scopedOrgId ? eq(branchesTable.organizationId, scopedOrgId) : undefined,
                scopedBranchId ? eq(branchesTable.id, scopedBranchId) : undefined
            ))
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
