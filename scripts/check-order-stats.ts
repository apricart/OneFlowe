import { db } from "../lib/db";
import { orders } from "../db/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Fetching order status distribution...");
  
  const stats = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(orders)
    .groupBy(orders.status);

  const total = stats.reduce((acc, curr) => acc + curr.count, 0);

  const result = {
    stats,
    total,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(path.resolve(process.cwd(), "scripts/order-stats-output.json"), JSON.stringify(result, null, 2));
  console.log("Results written to scripts/order-stats-output.json");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
