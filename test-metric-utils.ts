import { db } from "./lib/db"
import { metricExpressions } from "./lib/metric-utils"
import { orders } from "./db/schema"
import { sql } from "drizzle-orm"

async function run() {
  try {
    const q = await db.select({
      bucket: sql`date_trunc('day', ${orders.createdAt})`,
      revenue: metricExpressions.revenue
    }).from(orders).groupBy(sql`date_trunc('day', ${orders.createdAt})`).limit(1)
    console.log("Success:", q)
  } catch (e) {
    console.log("Error:", e)
  }
  process.exit(0)
}
run()
