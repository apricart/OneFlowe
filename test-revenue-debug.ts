import { db } from "./lib/db"
import { orders, orderItems, refundItems } from "./db/schema"
import { sql, eq, inArray } from "drizzle-orm"

async function run() {
  // 1. Old formula (order-level): totalCents - refundAmountCents
  const [oldResult] = await db.select({
    oldRevenue: sql<number>`COALESCE(SUM(
      CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED', 'APPROVED') THEN 
        ${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0) 
      ELSE 0 END
    ), 0)`.mapWith(Number)
  }).from(orders)

  // 2. New formula (product-level subquery): SUM(oi.price_cents * oi.quantity) - refund_items
  const [newResult] = await db.select({
    newRevenue: sql<number>`COALESCE(SUM(
      CASE WHEN UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED', 'APPROVED') THEN
        COALESCE((SELECT SUM(oi.price_cents * oi.quantity) FROM order_items oi WHERE oi.order_id = orders.id), 0) -
        COALESCE((
          SELECT SUM(ri.amount_cents) 
          FROM refund_items ri 
          JOIN refunds r ON ri.refund_id = r.id 
          WHERE r.order_id = orders.id AND UPPER(r.status) IN ('APPROVED', 'COMPLETED')
        ), 0)
      ELSE 0 END
    ), 0)`.mapWith(Number)
  }).from(orders)

  // 3. Check a few sample orders to see what's happening
  const sampleOrders = await db.select({
    orderId: orders.id,
    tid: orders.tid,
    status: orders.status,
    totalCents: orders.totalCents,
    refundAmountCents: orders.refundAmountCents,
    itemsSum: sql<number>`COALESCE((SELECT SUM(oi.price_cents * oi.quantity) FROM order_items oi WHERE oi.order_id = orders.id), 0)`.mapWith(Number),
    refundItemsSum: sql<number>`COALESCE((SELECT SUM(ri.amount_cents) FROM refund_items ri JOIN refunds r ON ri.refund_id = r.id WHERE r.order_id = orders.id AND UPPER(r.status) IN ('APPROVED', 'COMPLETED')), 0)`.mapWith(Number),
  }).from(orders)
    .where(sql`UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED', 'APPROVED')`)
    .limit(10)

  console.log("=== REVENUE COMPARISON ===")
  console.log("Old formula (totalCents - refundAmountCents):", (oldResult.oldRevenue / 100).toFixed(2))
  console.log("New formula (orderItems - refundItems):", (newResult.newRevenue / 100).toFixed(2))
  console.log("Difference:", ((oldResult.oldRevenue - newResult.newRevenue) / 100).toFixed(2))
  console.log("\n=== SAMPLE ORDERS ===")
  sampleOrders.forEach(o => {
    const diff = (o.totalCents || 0) - o.itemsSum
    console.log(`Order ${o.tid} | status=${o.status} | totalCents=${o.totalCents} | itemsSum=${o.itemsSum} | diff=${diff} | refundAmt=${o.refundAmountCents} | refundItemsSum=${o.refundItemsSum}`)
  })

  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
