import { db } from "./lib/db";
import { orders } from "./db/schema";
import { gt, sql } from "drizzle-orm";

async function run() {
  const res = await db.select({ 
    status: orders.status, 
    count: sql<number>`count(*)` 
  }).from(orders)
    .where(gt(orders.status, "")) // just to filter
    .groupBy(orders.status);
    
  const partials = await db.select({
    status: orders.status,
    count: sql<number>`count(*)`
  }).from(orders)
    .where(gt(orders.refundAmountCents, 0))
    .groupBy(orders.status);

  console.log("ALL STATUSES:", JSON.stringify(res, null, 2));
  console.log("PARTIAL REFUND STATUSES:", JSON.stringify(partials, null, 2));
  process.exit(0);
}
run();
