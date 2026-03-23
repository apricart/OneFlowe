import { db } from "./lib/db";
import { orders } from "./db/schema";
import { sql } from "drizzle-orm";

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

  console.log("\nOrder Status Breakdown:");
  console.table(stats);
  console.log(`\nTotal Orders in Database: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
