import { db } from "./lib/db"
import { orders, orderItems } from "./db/schema"
import { sql, inArray, eq } from "drizzle-orm"

async function run() {
  const result = await db.select({
    orderSumCents: sql`SUM(${orders.totalCents})`,
    orderRefundCents: sql`SUM(COALESCE(${orders.refundAmountCents}, 0))`,
    itemSumCents: sql`
      (SELECT SUM(${orderItems.priceCents} * ${orderItems.quantity}) 
       FROM ${orderItems} 
       INNER JOIN ${orders} o2 ON ${orderItems.orderId} = o2.id 
       WHERE UPPER(o2.status) IN ('FULFILLED', 'REFUNDED'))
    `
  })
  .from(orders)
  .where(inArray(orders.status, ['FULFILLED', 'REFUNDED']))

  const approvedSum = await db.select({
    orderSumCents: sql`SUM(${orders.totalCents})`,
    itemSumCents: sql`
      (SELECT SUM(${orderItems.priceCents} * ${orderItems.quantity}) 
       FROM ${orderItems} 
       INNER JOIN ${orders} o2 ON ${orderItems.orderId} = o2.id 
       WHERE UPPER(o2.status) = 'APPROVED')
    `
  })
  .from(orders)
  .where(inArray(orders.status, ['APPROVED']))

  console.log("FULFILLED & REFUNDED:", result[0])
  console.log("APPROVED:", approvedSum[0])
  
  process.exit(0)
}
run()
