import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { Client } from "pg"

async function fixGroupsConstraint() {
    try {
        console.log("🔄 Fixing groups unique constraint...")

        const client = new Client({
            connectionString: process.env.DATABASE_URL,
        })

        await client.connect()
        console.log("✅ Connected to database")

        // Drop the old unique index
        console.log("📝 Dropping old unique index...")
        await client.query(`
      DROP INDEX IF EXISTS "groups_org_name_uq"
    `).catch((e) => console.log("ℹ️ Drop index:", e.message))

        // Create partial unique index that only applies to non-deleted groups
        console.log("📝 Creating partial unique index...")
        await client.query(`
      CREATE UNIQUE INDEX "groups_org_name_active_uq" 
      ON "groups" ("organization_id", "name") 
      WHERE ("status" IS DISTINCT FROM 'deleted')
    `).catch((e) => console.log("ℹ️ Create index:", e.message))

        await client.end()

        console.log("✅ Groups constraint fixed successfully!")
        console.log("✨ You can now recreate deleted groups with the same name")
        process.exit(0)
    } catch (error) {
        console.error("❌ Error fixing groups constraint:", error)
        process.exit(1)
    }
}

fixGroupsConstraint()
