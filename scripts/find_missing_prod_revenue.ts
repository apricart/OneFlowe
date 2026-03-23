import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    // Orders in Dash (Net)
    const res = await client.query(`
      SELECT 
        o.tid, 
        (o.total_cents - COALESCE(o.refund_amount_cents, 0)) / 100 as net_revenue,
        COALESCE((
            SELECT SUM(oi.price_cents * (oi.quantity - COALESCE(ri.quantity, 0))) 
            FROM order_items oi 
            INNER JOIN global_products gp ON oi.global_product_id = gp.id
            LEFT JOIN refund_items ri ON oi.id = ri.order_item_id
            WHERE oi.order_id = o.id
        ), 0) / 100 as prod_performance_net
      FROM orders o
      WHERE UPPER(o.status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    
    let totalDiff = 0;
    for (const row of res.rows) {
        const diff = Number(row.net_revenue) - Number(row.prod_performance_net);
        if (diff !== 0) {
            console.log(`TID: ${row.tid}, Dash: ${row.net_revenue}, Prod: ${row.prod_performance_net}, Diff: ${diff}`);
            totalDiff += diff;
        }
    }
    console.log("Total Difference:", totalDiff);

  } finally {
    await client.end();
  }
}

check();
