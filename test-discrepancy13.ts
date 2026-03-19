import { db } from "./lib/db"
import { orders } from "./db/schema"
import { sql } from "drizzle-orm"

async function run() {
  const result = await db.select({
    dashboardRevenue: sql`SUM(
      CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED', 'APPROVED') THEN
        COALESCE((SELECT SUM(oi.price_cents * oi.quantity) FROM order_items oi WHERE oi.order_id = orders.id), 0) -
        COALESCE((
          SELECT SUM(ri.amount_cents)
          FROM refund_items ri
          JOIN refunds r ON ri.refund_id = r.id
          WHERE r.order_id = orders.id AND UPPER(r.status) IN ('APPROVED', 'COMPLETED')
        ), 0)
      ELSE 0 END
    )`
  })
  .from(orders)
  
  console.log("Check:", result[0])
  process.exit(0)
}
run()
