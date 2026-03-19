import { db } from "./lib/db"
import { orders, orderItems } from "./db/schema"
import { sql } from "drizzle-orm"

async function run() {
  const result = await db.select({
    grossTotal: sql`SUM(${orders.totalCents})`,
    grossSubtotal: sql`SUM(${orders.subtotalCents})`,
    grossItems: sql`(SELECT SUM(${orderItems.priceCents} * ${orderItems.quantity}) FROM ${orderItems} INNER JOIN ${orders} o2 ON ${orderItems.orderId} = o2.id WHERE UPPER(o2.status) IN ('FULFILLED', 'REFUNDED'))`,
    proposedRevenue: sql`SUM(CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED', 'APPROVED') THEN ${orders.subtotalCents} - COALESCE(${orders.refundAmountCents}, 0) ELSE 0 END)`,
  })
  .from(orders)
  .where(sql`UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED')`)
  
  console.log("Check:", result[0])
  process.exit(0)
}
run()
