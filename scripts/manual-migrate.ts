import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { Client } from "pg"
import fs from "fs"
import path from "path"

async function applyMigration() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
    if (!connectionString) {
        console.error("❌ No database URL found")
        process.exit(1)
    }

    console.log("🔄 Applying migration using connection:", connectionString.split("@")[1])

    const client = new Client({
        connectionString,
    })

    try {
        await client.connect()

        const migrationFile = "20260121164846_legal_aqueduct.sql"
        const migrationPath = path.join(process.cwd(), "drizzle", migrationFile)

        if (!fs.existsSync(migrationPath)) {
            console.error("❌ Migration file not found:", migrationPath)
            process.exit(1)
        }

        const sql = fs.readFileSync(migrationPath, "utf8")
        const statements = sql.split("--> statement-breakpoint")

        console.log(`📝 Found ${statements.length} statements in ${migrationFile}`)

        for (let i = 0; i < statements.length; i++) {
            let stmt = statements[i].trim()
            if (!stmt) continue

            console.log(`🚀 Executing statement ${i + 1}...`)
            try {
                await client.query(stmt)
            } catch (e: any) {
                console.log(`⚠️ Statement ${i + 1} failed:`, e.message)
                // Continue as some might already exist if partially applied
            }
        }

        await client.end()
        console.log("✅ Migration applied (with some potential skips)!")
        process.exit(0)
    } catch (error) {
        console.error("❌ Error applying migration:", error)
        process.exit(1)
    }
}

applyMigration()
