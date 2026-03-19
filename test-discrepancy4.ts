import { db } from "./lib/db"
import { orders, orderItems, refundItems } from "./db/schema"
import { sql, inArray, eq } from "drizzle-orm"

async function run() {
  const result = await db.select({
    orderId: orders.id,
    globalProductId: orderItems.globalProductId,
    qtyOrdered: orderItems.quantity,
    priceCents: orderItems.priceCents,
    refundQty: sql`COALESCE((SELECT SUM(${refundItems.quantity}) FROM ${refundItems} WHERE ${refundItems.orderItemId} = ${orderItems.id}), 0)`
  })
  .from(orders)
  .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
  .where(inArray(orders.status, ['FULFILLED', 'REFUNDED']))

  let totalRevenueCents = 0
  result.forEach(row => {
    if (row.qtyOrdered) {
        const qtyToCount = Math.max(0, row.qtyOrdered - (Number(row.refundQty) || 0))
        totalRevenueCents += (qtyToCount * (row.priceCents || 0))
    }
  })

  console.log("Calculated Product Intelligence Revenue:", totalRevenueCents)
  
  process.exit(0)
}
run()
