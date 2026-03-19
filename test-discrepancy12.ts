import { db } from "./lib/db"
import { sql } from "drizzle-orm"

async function run() {
  const result = await db.execute(sql`
    SELECT SUM(ri.amount_cents) as total_refund_items
    FROM refund_items ri
    JOIN refunds r ON ri.refund_id = r.id
    WHERE UPPER(r.status) = 'APPROVED'
  `)
  console.log("Total Refund Items (Approved):", result.rows[0])
  
  const allRefunds = await db.execute(sql`
    SELECT SUM(r.amount_cents) as total_refunds
    FROM refunds r
    WHERE UPPER(r.status) = 'APPROVED'
  `)
  console.log("Total Refunds (Approved):", allRefunds.rows[0])
  process.exit(0)
}
run()
