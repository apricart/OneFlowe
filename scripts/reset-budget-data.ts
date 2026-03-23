import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { budgets, budgetAddons, auditLogs } from "../db/schema";

async function resetBudgetData() {
  console.log("🚀 Starting budget data reset...");

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ No DATABASE_URL or DIRECT_URL found");
    process.exit(1);
  }

  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const db = drizzle(pool);

  try {
    // 1. Truncate budget_addons (cascade-ready)
    console.log("🗑️ Clearing budget_addons...");
    await db.delete(budgetAddons);

    // 2. Truncate budgets
    console.log("🗑️ Clearing budgets...");
    await db.delete(budgets);

    // 3. Log the reset in audit_logs
    console.log("📝 Logging reset action...");
    await db.insert(auditLogs).values({
      action: "RESET_ALL_BUDGET_DATA",
      entity: "SYSTEM",
      metadata: {
        reason: "User requested complete budget data reset for new monthly system",
        timestamp: new Date().toISOString(),
      },
    });

    console.log("✅ Budget data reset successfully!");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during budget data reset:", error);
    await pool.end();
    process.exit(1);
  }
}

resetBudgetData();
