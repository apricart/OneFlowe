import { db } from "./lib/db";
import { orders } from "./db/schema";
import { sql, gt } from "drizzle-orm";
import fs from "fs";

async function main() {
  console.log("Investigating orders with refunds...");
  
  const ordersWithRefunds = await db
    .select({
      id: orders.id,
      tid: orders.tid,
      status: orders.status,
      totalCents: orders.totalCents,
      refundAmountCents: orders.refundAmountCents,
    })
    .from(orders)
    .where(gt(orders.refundAmountCents, 0));

  const results = {
    allWithRefunds: ordersWithRefunds,
    potentialPartials: ordersWithRefunds.filter(o => o.status.toUpperCase() !== 'REFUNDED'),
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync("partial_investigation.json", JSON.stringify(results, null, 2));
  console.log("Results written to partial_investigation.json");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
