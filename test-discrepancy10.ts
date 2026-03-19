import { db } from "./lib/db"
import { orders, orderItems, refundItems } from "./db/schema"
import { sql } from "drizzle-orm"

async function run() {
  const result = await db.select({
    dashboardRevenue: sql`SUM(
      CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED', 'APPROVED') THEN
        COALESCE((SELECT SUM(oi.price_cents * oi.quantity) FROM order_items oi WHERE oi.order_id = orders.id), 0) -
        COALESCE((SELECT SUM(ri.amount_cents) FROM refund_items ri JOIN order_items oi ON ri.order_item_id = oi.id WHERE oi.order_id = orders.id), 0)
      ELSE 0 END
    )`
  })
  .from(orders)
  
  console.log("Check:", result[0])
  process.exit(0)
}
run()
