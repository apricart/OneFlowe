import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "../lib/db"
import { branchInventory } from "../db/schema"
import { sql } from "drizzle-orm"

async function debugTable() {
    try {
        console.log("🧪 Checking branch_inventory table...")

        // Check if table exists and has columns
        const columns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branch_inventory'
    `)
        console.log("Columns:", columns.rows)

        const rows = await db.select().from(branchInventory).limit(5)
        console.log("Sample rows:", rows)

        process.exit(0)
    } catch (e: any) {
        console.error("❌ Error:", e.message)
        process.exit(1)
    }
}

debugTable()
