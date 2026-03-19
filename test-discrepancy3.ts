import { db } from "./lib/db"
import { orders } from "./db/schema"
import { sql, inArray } from "drizzle-orm"

async function run() {
  const result = await db.select({
    dashboardNetSales: sql`SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED') THEN ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END)`,
    dashboardWithApproved: sql`SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED', 'APPROVED') THEN ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END)`
  })
  .from(orders)

  console.log("Revenues:", result[0])
  
  process.exit(0)
}
run()
