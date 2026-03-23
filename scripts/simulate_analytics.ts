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
    // 1. Dashboard Revenue Logic (Net)
    const dashRes = await client.query(`
      SELECT SUM(total_cents - COALESCE(refund_amount_cents, 0)) as total
      FROM orders 
      WHERE UPPER(status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    console.log("Dashboard Revenue Total:", dashRes.rows[0].total / 100);

    // 2. Product Analytics Revenue Logic
    const prodRes = await client.query(`
      SELECT SUM(oi.price_cents * (oi.quantity - COALESCE(ri.quantity, 0))) as total
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN global_products gp ON oi.global_product_id = gp.id
      LEFT JOIN refund_items ri ON oi.id = ri.order_item_id
      WHERE UPPER(o.status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    console.log("Product Analytics Total:", prodRes.rows[0].total / 100);

    // 3. Check for specific status counts
    const statusRes = await client.query(`
      SELECT UPPER(status), count(*) FROM orders GROUP BY 1
    `);
    console.log("Status Counts:", statusRes.rows);

  } finally {
    await client.end();
  }
}

check();
