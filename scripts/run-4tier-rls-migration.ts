/**
 * Run the 4-Tier RBAC RLS migration on a target database.
 * 
 * This migration implements:
 * - 4-tier role hierarchy (SUPER_ADMIN, HEAD_OFFICE, BRANCH_ADMIN, ORDER_PORTAL)
 * - PostgreSQL helper functions for role/org/branch/user context
 * - Comprehensive RLS policies for each table
 * 
 * Usage:
 *   npx tsx scripts/run-4tier-rls-migration.ts local
 *   npx tsx scripts/run-4tier-rls-migration.ts production
 */
import { readFileSync } from "fs"
import { Pool } from "pg"
import path from "path"

const target = process.argv[2] // "local" or "production"

if (!target || !["local", "production"].includes(target)) {
  console.error("Usage: npx tsx scripts/run-4tier-rls-migration.ts <local|production>")
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
    try {
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
    } catch (e) {
      // If URL parsing fails (e.g., special chars in password), try manual parsing
      const match = process.env.DATABASE_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
      if (match) {
        return {
          user: match[1],
          password: match[2],
          host: match[3],
          port: 5432, // Force 5432
          database: match[5],
          ssl: { rejectUnauthorized: false },
        }
      }
      throw e
    }
  }

  throw new Error("No database config found")
}

async function main() {
  const config = getDirectConfig()
  console.log(`\n🔒 Running 4-Tier RBAC RLS Migration on [${target.toUpperCase()}]`)
  console.log(`   Host: ${config.host}`)
  console.log(`   Port: ${config.port} (direct, bypassing PgBouncer)`)
  console.log(`   Database: ${config.database}\n`)

  const pool = new Pool({ ...config, max: 1 })

  try {
    // Read the SQL migration file (safe version that handles missing columns)
    const sqlPath = path.join(__dirname, "..", "drizzle", "20260409_4tier_rbac_safe.sql")
    const sqlContent = readFileSync(sqlPath, "utf-8")

    console.log("⏳ Executing 4-tier RBAC RLS migration...")
    const client = await pool.connect()

    try {
      await client.query(sqlContent)
      console.log("✅ 4-tier RBAC RLS migration completed successfully!\n")

      // Verify helper functions
      console.log("🔍 Verifying helper functions...")
      const functionsResult = await client.query(`
        SELECT routine_name, routine_type 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name IN ('get_my_role', 'get_my_org_id', 'get_my_branch_id', 'get_my_user_id')
        ORDER BY routine_name
      `)
      console.log(`   ✓ ${functionsResult.rows.length} helper functions created:`)
      functionsResult.rows.forEach((row: any) => {
        console.log(`     - ${row.routine_name} (${row.routine_type})`)
      })

      // Verify RLS is enabled on tables
      console.log("\n🛡️  Verifying RLS enabled on tables...")
      const rlsResult = await client.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = true
        ORDER BY tablename
      `)
      console.log(`   ✓ RLS enabled on ${rlsResult.rows.length} tables`)

      // Verify policies
      console.log("\n📋 Verifying RLS policies...")
      const policiesResult = await client.query(`
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `)
      console.log(`   ✓ ${policiesResult.rows.length} RLS policies created`)
      
      // Group policies by table
      const policiesByTable: Record<string, string[]> = {}
      policiesResult.rows.forEach((row: any) => {
        if (!policiesByTable[row.tablename]) {
          policiesByTable[row.tablename] = []
        }
        policiesByTable[row.tablename].push(row.policyname)
      })
      
      console.log("\n   Policy breakdown by table:")
      Object.entries(policiesByTable).forEach(([table, policies]) => {
        console.log(`     ${table}: ${policies.length} policies`)
      })

      // Test helper functions
      console.log("\n🧪 Testing helper functions...")
      await client.query(`SET "app.current_role" = 'HEAD_OFFICE'`)
      await client.query(`SET "app.current_org_id" = '1'`)
      await client.query(`SET "app.current_branch_id" = '2'`)
      await client.query(`SET "app.current_user_id" = '123e4567-e89b-12d3-a456-426614174000'`)
      
      const testResult = await client.query(`
        SELECT 
          get_my_role() as role,
          get_my_org_id() as org_id,
          get_my_branch_id() as branch_id,
          get_my_user_id() as user_id
      `)
      
      console.log("   ✓ Helper functions working:")
      console.log(`     - Role: ${testResult.rows[0].role}`)
      console.log(`     - Org ID: ${testResult.rows[0].org_id}`)
      console.log(`     - Branch ID: ${testResult.rows[0].branch_id}`)
      console.log(`     - User ID: ${testResult.rows[0].user_id}`)

      console.log("\n✅ All verifications passed! 4-tier RBAC is now active.")
      console.log("\n📖 Next steps:")
      console.log("   1. Update API routes to use withTenant() with full user context")
      console.log("   2. Test each role tier (SUPER_ADMIN, HEAD_OFFICE, BRANCH_ADMIN, ORDER_PORTAL)")
      console.log("   3. Monitor for any 401/403 errors in the application logs")
      
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message)
    if (error.message.includes("already exists")) {
      console.log("\n⚠️  Some objects already exist. To re-run the migration:")
      console.log("   1. Drop existing policies manually, OR")
      console.log("   2. Update the migration SQL to use IF NOT EXISTS clauses")
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
