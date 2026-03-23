import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { budgets, branches, orders } from "../db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

async function syncBudgetHistory() {
  console.log("🔄 Starting budget history synchronization...");

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const db = drizzle(pool);

  try {
    // 1. Fetch all branches
    const allBranches = await db.select().from(branches);
    console.log(`📊 Found ${allBranches.length} branches.`);

    // 2. Fetch spending grouped by branch and month
    // We cover a wide range to be sure (2020-2026)
    const spendingData = await db
      .select({
        branchId: orders.branchId,
        period: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`,
        totalSpent: sql<number>`SUM(CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN ${orders.totalCents} ELSE 0 END)`.mapWith(Number),
        totalHeld: sql<number>`SUM(CASE WHEN UPPER(${orders.status}) = 'APPROVED' THEN ${orders.totalCents} ELSE 0 END)`.mapWith(Number),
      })
      .from(orders)
      .groupBy(orders.branchId, sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM')`);

    console.log(`📈 Calculated spending for ${spendingData.length} branch-month combinations.`);

    // 3. Sync into budgets table
    for (const data of spendingData) {
      const branch = allBranches.find(b => b.id === data.branchId);
      if (!branch) continue;

      console.log(`⚡ Syncing ${branch.name} for ${data.period}: Spent ${data.totalSpent / 100} PKR`);

      await db.insert(budgets)
        .values({
          organizationId: branch.organizationId,
          branchId: branch.id,
          period: data.period,
          amountAllocatedCents: branch.baselineBudgetCents || 0,
          amountSpentCents: data.totalSpent,
          amountHeldCents: data.totalHeld,
          amountCreditedCents: 0,
        })
        .onConflictDoUpdate({
          target: [budgets.branchId, budgets.period],
          set: {
            amountSpentCents: data.totalSpent,
            amountHeldCents: data.totalHeld,
            updatedAt: new Date(),
          }
        });
    }

    console.log("✅ Budget history synchronization complete!");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Synchronization failed:", error);
    await pool.end();
    process.exit(1);
  }
}

syncBudgetHistory();
