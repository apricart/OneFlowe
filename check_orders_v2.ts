import { db } from "./lib/db";
import { orders } from "./db/schema";
import { sql } from "drizzle-orm";
import fs from "fs";

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

  const results = {
    stats,
    total,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync("research_results.json", JSON.stringify(results, null, 2), "utf8");
  console.log("Results written to research_results.json");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
