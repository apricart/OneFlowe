import { db } from "./lib/db"
import { orders, orderItems } from "./db/schema"
import { sql, inArray, eq } from "drizzle-orm"

async function run() {
  const result = await db.select({
    orderId: orders.id,
    totalCents: orders.totalCents,
    status: orders.status,
    itemSum: sql`SUM(${orderItems.priceCents} * ${orderItems.quantity})`
  })
  .from(orders)
  .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
  .where(inArray(orders.status, ['FULFILLED']))
  .groupBy(orders.id)
  .having(sql`${orders.totalCents} != SUM(${orderItems.priceCents} * ${orderItems.quantity})`)
  .limit(5)
  console.log("Mismatches found:", result)
  process.exit(0)
}
run()
