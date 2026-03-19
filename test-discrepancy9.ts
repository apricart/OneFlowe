import { db } from "./lib/db"
import { orders, orderItems } from "./db/schema"
import { sql, eq } from "drizzle-orm"

async function run() {
  const q = await db.select({
    orderId: orders.id,
    subtotalCents: orders.subtotalCents,
    itemSum: sql`SUM(${orderItems.priceCents} * ${orderItems.quantity})`
  })
  .from(orders)
  .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
  .groupBy(orders.id)
  .having(sql`${orders.subtotalCents} > SUM(${orderItems.priceCents} * ${orderItems.quantity})`)
  .limit(5)

  console.log("Mismatched orders:", q)
  process.exit(0)
}
run()
