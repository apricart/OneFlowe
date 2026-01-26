import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { Client } from "pg"

async function fixSchema() {
    try {
        console.log("🔄 Fixing branches schema...")

        const client = new Client({
            connectionString: process.env.DATABASE_URL,
        })

        await client.connect()

        // Add group_id column to branches table
        console.log("📝 Adding group_id to branches table if missing...")
        await client.query(`
      ALTER TABLE "branches"
      ADD COLUMN IF NOT EXISTS "group_id" integer
    `).catch((e) => console.log("ℹ️ Error adding group_id:", e.message))

        // Add FK constraint if missing
        await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'branches_group_id_groups_id_fk') THEN
          ALTER TABLE "branches"
          ADD CONSTRAINT "branches_group_id_groups_id_fk"
          FOREIGN KEY ("group_id") REFERENCES "groups"("id");
        END IF;
      END $$;
    `).catch((e) => console.log("ℹ️ Error adding FK:", e.message))

        await client.end()

        console.log("✅ Schema fixed successfully!")
        process.exit(0)
    } catch (error) {
        console.error("❌ Error fixing schema:", error)
        process.exit(1)
    }
}

fixSchema()
