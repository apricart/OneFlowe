/**
 * Run the RLS migration on a target database.
 * 
 * Usage:
 *   npx tsx scripts/run-rls-migration.ts local
 *   npx tsx scripts/run-rls-migration.ts production
 */
import { readFileSync } from "fs"
import { Pool } from "pg"
import path from "path"

const target = process.argv[2] // "local" or "production"

if (!target || !["local", "production"].includes(target)) {
  console.error("Usage: npx tsx scripts/run-rls-migration.ts <local|production>")
  process.exit(1)
}

// Load the correct .env file
const dotenv = require("dotenv")
dotenv.config({ path: target === "production" ? ".env.production" : ".env.local" })

// Build connection config — use DIRECT connection (port 5432), NOT pgbouncer (6543)
// PgBouncer in transaction mode doesn't support SET LOCAL or DDL properly
function getDirectConfig() {
  if (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_HOST) {
    return {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      // Force port 5432 for direct connection (bypass pgbouncer on 6543)
      port: 5432,
      database: process.env.DB_NAME || "postgres",
      ssl: { rejectUnauthorized: false },
    }
  }

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL)
    return {
      host: url.hostname,
      // Force port 5432 for direct connection
      port: 5432,
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: { rejectUnauthorized: false },
    }
  }

  throw new Error("No database config found")
}

async function main() {
  const config = getDirectConfig()
  console.log(`\n🔒 Running RLS migration on [${target.toUpperCase()}]`)
  console.log(`   Host: ${config.host}`)
  console.log(`   Port: ${config.port} (direct, bypassing PgBouncer)`)
  console.log(`   Database: ${config.database}\n`)

  const pool = new Pool({ ...config, max: 1 })

  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, "..", "drizzle", "20260408_enable_rls.sql")
    const sqlContent = readFileSync(sqlPath, "utf-8")

    console.log("⏳ Executing RLS migration...")
    const client = await pool.connect()

    try {
      await client.query(sqlContent)
      console.log("✅ RLS migration completed successfully!")

      // Verify RLS is enabled
      const result = await client.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = true
        ORDER BY tablename
      `)
      console.log(`\n🛡️  RLS is now enabled on ${result.rows.length} tables:`)
      result.rows.forEach((row: any) => {
        console.log(`   ✓ ${row.tablename}`)
      })

      // Verify policies
      const policies = await client.query(`
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `)
      console.log(`\n📋 ${policies.rows.length} RLS policies created:`)
      policies.rows.forEach((row: any) => {
        console.log(`   ✓ ${row.tablename} → ${row.policyname}`)
      })
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message)
    if (error.message.includes("policy \"tenant_isolation\" for table")) {
      console.log("\n⚠️  Policies already exist. This migration may have already been run.")
      console.log("   If you want to re-run, first drop existing policies with:")
      console.log("   DROP POLICY tenant_isolation ON \"table_name\";")
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
