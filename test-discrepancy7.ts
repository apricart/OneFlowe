import { db } from "./lib/db"
import { orders } from "./db/schema"
import { sql } from "drizzle-orm"

async function run() {
  const result = await db.select({
    orderSumCents: sql`SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED') THEN ${orders.totalCents} ELSE 0 END)`,
    orderRefundCents: sql`SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED') THEN COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END)`,
    dashboardNetSales: sql`SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED') THEN ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END)`,
  })
  .from(orders)
  
  console.log("Check:", result[0])
  process.exit(0)
}
run()
