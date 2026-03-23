import { db } from "./lib/db";
import { orders } from "./db/schema";
import { desc, sql } from "drizzle-orm";
import fs from "fs";

async function investigate() {
  console.log("Investigating order discrepancy...");
  
  // 1. Total count in DB
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  console.log(`Total orders in DB: ${allOrders.length}`);

  // 2. Group by status (case insensitive)
  const statusCounts = await db.select({
    status: sql<string>`UPPER(${orders.status})`,
    count: sql<number>`count(*)`
  }).from(orders).groupBy(sql`UPPER(${orders.status})`);

  // 3. Check for NULLs or weird dates
  const weirdOrders = allOrders.filter(o => !o.createdAt || !o.status || !o.tid);

  // 4. Check for orders without branchId or organizationId
  const missingRefs = allOrders.filter(o => !o.branchId || !o.organizationId);

  const results = {
    total: allOrders.length,
    statusCounts,
    weirdOrders: weirdOrders.map(o => ({ id: o.id, tid: o.tid, status: o.status, createdAt: o.createdAt })),
    missingRefs: missingRefs.map(o => ({ id: o.id, tid: o.tid, branchId: o.branchId, orgId: o.organizationId })),
    allTids: allOrders.map(o => o.tid)
  };

  fs.writeFileSync("discrepancy_research.json", JSON.stringify(results, null, 2));
  console.log("Results written to discrepancy_research.json");
  process.exit(0);
}

investigate();
