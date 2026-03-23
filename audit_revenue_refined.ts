import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from "./lib/db";
import { orders, orderItems, refundItems } from "./db/schema";
import { eq, sql } from "drizzle-orm";
import fs from "fs";

async function auditRevenueRefined() {
  console.log("Starting REFINED revenue audit (Itemized vs Table)...");

  const allOrders = await db.select().from(orders);

  let totalItemLevelRevenue = 0;
  let totalTableRevenue = 0;

  const details = [];

  for (const order of allOrders) {
    const status = (order.status || "").toUpperCase();
    
    // 1. Table Logic
    let tableRevenue = 0;
    if (['FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED', 'REFUNDED'].includes(status)) {
        tableRevenue = (order.totalCents - (order.refundAmountCents || 0)) / 100;
    }

    // 2. Refined Item Logic
    let itemRevenue = 0;
    if (['FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED', 'REFUNDED'].includes(status)) {
        const items = await db.select({
            priceCents: orderItems.priceCents,
            quantity: orderItems.quantity,
            refundQuantity: sql<number>`COALESCE(${refundItems.quantity}, 0)`.mapWith(Number)
        })
        .from(orderItems)
        .leftJoin(refundItems, eq(orderItems.id, refundItems.orderItemId))
        .where(eq(orderItems.orderId, order.id));

        const itemSumCents = items.reduce((acc, i) => {
            const fulfilledQty = i.quantity - i.refundQuantity;
            return acc + (i.priceCents * fulfilledQty);
        }, 0);
        
        itemRevenue = itemSumCents / 100;
    }

    totalItemLevelRevenue += itemRevenue;
    totalTableRevenue += tableRevenue;

    if (tableRevenue !== itemRevenue) {
        details.push({
            tid: order.tid,
            status,
            tableRevenue,
            itemRevenue,
            diff: tableRevenue - itemRevenue
        });
    }
  }

  const result = {
    summary: {
      totalTableRevenue,
      totalItemLevelRevenue,
      difference: totalTableRevenue - totalItemLevelRevenue
    },
    discrepancies: details
  };

  fs.writeFileSync("refined_audit.json", JSON.stringify(result, null, 2));
  console.log("Refined audit complete.");
  process.exit(0);
}

auditRevenueRefined();
