import { db } from "./lib/db"
import { orders, orderItems, refundItems, globalProducts, categories } from "./db/schema"
import { sql, inArray, eq } from "drizzle-orm"

async function run() {
  const q = await db
      .select({
          orderId: orders.id,
          status: orders.status,
          globalProductId: orderItems.globalProductId,
          qtyOrdered: orderItems.quantity,
          priceCents: orderItems.priceCents,
          orderItemId: orderItems.id
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inArray(orders.status, ['FULFILLED', 'REFUNDED']))

  const validOrderItemIds = q.map(r => r.orderItemId)
  let refundQuantities: Record<number, number> = {}

  if (validOrderItemIds.length > 0) {
      const refundsObj = await db
          .select({
              orderItemId: refundItems.orderItemId,
              qty: refundItems.quantity,
          })
          .from(refundItems)
          .where(inArray(refundItems.orderItemId, validOrderItemIds))

      refundQuantities = refundsObj.reduce((acc, curr) => {
          if (curr.orderItemId) {
              acc[curr.orderItemId] = (acc[curr.orderItemId] || 0) + curr.qty
          }
          return acc
      }, {} as Record<number, number>)
  }

  let totalRevenue = 0
  q.forEach(row => {
      if (row.status === 'FULFILLED') {
          totalRevenue += (row.qtyOrdered * row.priceCents)
      } else if (row.status === 'REFUNDED') {
          const refundedCount = refundQuantities[row.orderItemId] || 0
          const fulfilledCount = Math.max(0, row.qtyOrdered - refundedCount)
          totalRevenue += (fulfilledCount * row.priceCents)
      }
  })

  console.log("Product Intelligence Loop Revenue:", totalRevenue)
  process.exit(0)
}
run()
