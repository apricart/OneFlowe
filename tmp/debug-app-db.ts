import { db } from "../lib/db";
import { organizations, branches, budgets } from "../db/schema";
import { eq } from "drizzle-orm";

async function debug() {
  try {
    console.log("--- APP DB DEBUG ---");
    const orgs = await db.select().from(organizations);
    console.log("Organizations count:", orgs.length);
    console.table(orgs.map(o => ({ id: o.id, name: o.name })));

    if (orgs.length > 0) {
      const branchesRes = await db.select().from(branches);
      console.log("Branches count:", branchesRes.length);
      console.table(branchesRes.map(b => ({ id: b.id, name: b.name, orgId: b.organizationId })));

      const budgetsRes = await db.select().from(budgets);
      console.log("Budgets count:", budgetsRes.length);
      console.table(budgetsRes.map(b => ({ id: b.id, branchId: b.branchId, period: b.period, allocated: b.amountAllocatedCents })));
    }
  } catch (error) {
    console.error("Debug Error:", error);
  } finally {
    process.exit(0);
  }
}

debug();
