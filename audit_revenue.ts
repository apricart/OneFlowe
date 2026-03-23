import { db } from "./lib/db";
import { orders, orderItems, refundItems } from "./db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import fs from "fs";

async function auditRevenue() {
  console.log("Starting deep revenue audit...");

  // 1. Fetch all orders that are eligible for revenue
  const revenueOrders = await db.select().from(orders).where(
    sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED', 'REFUNDED')`
  );

  let totalItemLevelRevenue = 0;
  let totalOrderTableRevenue = 0;

  const auditResults = [];

  for (const order of revenueOrders) {
    // Current logic: Total - Refund
    const tableRevenue = (order.totalCents - (order.refundAmountCents || 0)) / 100;
    
    // Item-level logic: Sum(price * (qty - refundQty))
    const items = await db.select({
      priceCents: orderItems.priceCents,
      quantity: orderItems.quantity,
      refundQuantity: sql<number>`COALESCE(${refundItems.quantity}, 0)`.mapWith(Number)
    })
    .from(orderItems)
    .leftJoin(refundItems, eq(orderItems.id, refundItems.orderItemId))
    .where(eq(orderItems.orderId, order.id));

    const itemRevenueCents = items.reduce((acc, item) => {
      const fulfilledQty = item.quantity - item.refundQuantity;
      return acc + (item.priceCents * fulfilledQty);
    }, 0);

    const itemRevenue = itemRevenueCents / 100;

    totalItemLevelRevenue += itemRevenue;
    totalOrderTableRevenue += tableRevenue;

    auditResults.push({
      tid: order.tid,
      status: order.status,
      tableRevenue,
      itemRevenue,
      diff: tableRevenue - itemRevenue
    });
  }

  const summary = {
    orderCount: revenueOrders.length,
    totalTableRevenue: totalOrderTableRevenue,
    totalItemLevelRevenue: totalItemLevelRevenue,
    difference: totalOrderTableRevenue - totalItemLevelRevenue
  };

  fs.writeFileSync("revenue_audit.json", JSON.stringify({ summary, details: auditResults }, null, 2));
  console.log("Audit complete. Results in revenue_audit.json");
  process.exit(0);
}

auditRevenue();
