import { db } from "../lib/db";
import { organizations, branches, budgets } from "../db/schema";
import { eq } from "drizzle-orm";

async function debug() {
  try {
    console.log("--- ORGANIZATIONS ---");
    const orgs = await db.select().from(organizations);
    console.table(orgs.map(o => ({ id: o.id, name: o.name })));

    console.log("--- ALL BRANCHES (FIRST 50) ---");
    const branchesRes = await db.select().from(branches);
    console.table(branchesRes.map(b => ({ id: b.id, name: b.name, orgId: b.organizationId })));

    console.log("--- ALL BUDGET RECORDS (FIRST 50) ---");
    const budgetsRes = await db.select().from(budgets);
    console.table(budgetsRes.map(b => ({ id: b.id, branchId: b.branchId, period: b.period, allocated: b.amountAllocatedCents, spent: b.amountSpentCents, orgId: b.organizationId })));

  } catch (error) {
    console.error("Debug Error:", error);
  } finally {
    process.exit(0);
  }
}

debug();
