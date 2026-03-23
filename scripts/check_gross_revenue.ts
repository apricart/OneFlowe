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
      SELECT 
        SUM(oi.price_cents * oi.quantity) as gross_cents, 
        SUM(oi.price_cents * COALESCE(ri.quantity, 0)) as refund_cents 
      FROM order_items oi 
      INNER JOIN orders o ON oi.order_id = o.id 
      LEFT JOIN refund_items ri ON oi.id = ri.order_item_id 
      WHERE UPPER(o.status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    console.log("Gross (cents):", res.rows[0].gross_cents);
    console.log("Refund Loss (cents):", res.rows[0].refund_cents);
    console.log("Net (cents):", Number(res.rows[0].gross_cents) - Number(res.rows[0].refund_cents));
    console.log("Gross ($):", res.rows[0].gross_cents / 100);
    console.log("Refund Loss ($):", res.rows[0].refund_cents / 100);
    console.log("Net ($):", (Number(res.rows[0].gross_cents) - Number(res.rows[0].refund_cents)) / 100);
  } finally {
    await client.end();
  }
}

check();
