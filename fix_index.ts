import { db } from "./lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Dropping unique email indexes to allow duplicate emails...");
  
  try {
    // Drop unique email index on employee_credentials
    await db.execute(sql`DROP INDEX IF EXISTS "employee_creds_email_uq"`);
    console.log("✅ Dropped employee_creds_email_uq (if existed)");
  } catch (err: any) {
    console.error("❌ Error dropping employee_creds_email_uq:", err.message);
  }

  try {
    // Create non-unique replacement
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "employee_creds_email_idx" ON "employee_credentials" ("email")`);
    console.log("✅ Created non-unique email index on employee_credentials");
  } catch (err: any) {
    console.error("❌ Error creating replacement index:", err.message);
  }

  try {
    // Verify remaining unique indexes
    const res = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename IN ('users', 'employee_credentials') 
      AND indexdef LIKE '%UNIQUE%'
    `);
    const rows = (res as any).rows || res;
    console.log("\nRemaining UNIQUE indexes:");
    for (const r of rows) {
      console.log(`  ${r.indexname}: ${r.indexdef}`);
    }
  } catch (err: any) {
    console.error("❌ Error verifying:", err.message);
  }

  process.exit(0);
}

main();
