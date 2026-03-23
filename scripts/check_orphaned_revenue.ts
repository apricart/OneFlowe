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
    const res = await client.query(`
      SELECT SUM(oi.price_cents * (oi.quantity - COALESCE(ri.quantity, 0))) as total_cents 
      FROM order_items oi 
      INNER JOIN orders o ON oi.order_id = o.id 
      LEFT JOIN global_products gp ON oi.global_product_id = gp.id 
      LEFT JOIN refund_items ri ON oi.id = ri.order_item_id 
      WHERE gp.id IS NULL 
      AND UPPER(o.status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    console.log("Orphaned Revenue:", res.rows[0].total_cents / 100);
  } finally {
    await client.end();
  }
}

check();
