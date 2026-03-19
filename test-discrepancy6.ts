import { db } from "./lib/db"
import { orders, orderItems } from "./db/schema"
import { sql, eq } from "drizzle-orm"

async function run() {
  const q = await db.select({
    orderId: orders.id,
    totalCents: orders.totalCents,
    subtotalCents: orders.subtotalCents,
    itemSum: sql`SUM(${orderItems.priceCents} * ${orderItems.quantity})`
  })
  .from(orders)
  .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
  .groupBy(orders.id)
  .having(sql`${orders.totalCents} < SUM(${orderItems.priceCents} * ${orderItems.quantity})`)
  .limit(1)

  console.log("Mismatched order:", q[0])

  if (q.length > 0) {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, q[0].orderId))
      console.log("Items for that order:", items)
  }
  process.exit(0)
}
run()
