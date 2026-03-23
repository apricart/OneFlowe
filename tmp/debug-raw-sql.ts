import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function debugRawSQL() {
  try {
    console.log("--- RAW SQL BUDGET CHECK ---");
    const res = await db.execute(sql`SELECT id, branch_id, period, amount_allocated_cents, organization_id FROM budgets WHERE organization_id = 1`);
    console.log("Records found:", res.length);
    console.table(res);
  } catch (error) {
    console.error("Debug Error:", error);
  } finally {
    process.exit(0);
  }
}

debugRawSQL();
