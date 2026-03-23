import { db } from "../lib/db";
import { budgets, branches } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";

async function repair() {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    console.log(`--- REPAIRING BUDGETS FOR ${currentMonth} ---`);

    // Find all branches with a baseline > 0
    const allBranches = await db.select().from(branches).where(sql`${branches.baselineBudgetCents} > 0`);
    
    for (const branch of allBranches) {
      // Check if a budget record exists for the current month with 0 allocation
      const existing = await db.select().from(budgets).where(
        and(
          eq(budgets.branchId, branch.id),
          eq(budgets.period, currentMonth)
        )
      );

      if (existing.length > 0 && (existing[0].amountAllocatedCents === 0)) {
         console.log(`Repairing Branch ${branch.id} (${branch.name}): 0 -> ${branch.baselineBudgetCents}`);
         await db.update(budgets)
           .set({ amountAllocatedCents: branch.baselineBudgetCents })
           .where(eq(budgets.id, existing[0].id));
      } else if (existing.length === 0) {
         console.log(`Initializing Branch ${branch.id} (${branch.name}): -> ${branch.baselineBudgetCents}`);
         await db.insert(budgets).values({
           organizationId: branch.organizationId,
           branchId: branch.id,
           period: currentMonth,
           amountAllocatedCents: branch.baselineBudgetCents,
           amountSpentCents: 0,
           amountHeldCents: 0,
           amountCreditedCents: 0,
         });
      }
    }

    console.log("--- REPAIR COMPLETE ---");
  } catch (error) {
    console.error("Repair Error:", error);
  } finally {
    process.exit(0);
  }
}

repair();
