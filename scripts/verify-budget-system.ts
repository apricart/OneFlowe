import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { budgets, budgetAddons, branches } from "../db/schema";
import { eq } from "drizzle-orm";

async function verifyBudgetSystem() {
  console.log("🔍 Starting budget system verification...");

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const db = drizzle(pool);

  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // 1. Check if any budgets were created (auto-initialized)
    const allBudgets = await db.select().from(budgets).where(eq(budgets.period, currentMonth));
    console.log(`📊 Total budget records for ${currentMonth}: ${allBudgets.length}`);

    if (allBudgets.length > 0) {
      const sample = allBudgets[0];
      const branch = await db.select().from(branches).where(eq(branches.id, sample.branchId)).limit(1);
      console.log(`✅ Sample Branch: ${branch[0]?.name}`);
      console.log(`✅ Allocated: ${sample.amountAllocatedCents / 100} PKR (Baseline: ${branch[0]?.baselineBudgetCents / 100} PKR)`);
    } else {
      console.warn("⚠️ No budget records found. You might need to visit the Budget page in the browser to trigger auto-initialization.");
    }

    // 2. Check budget_addons
    const allAddons = await db.select().from(budgetAddons);
    console.log(`➕ Total addon records: ${allAddons.length}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    await pool.end();
    process.exit(1);
  }
}

verifyBudgetSystem();
