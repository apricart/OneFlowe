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
    // 1. Orders with NO items
    const noItems = await client.query(`
      SELECT o.tid, o.total_cents, o.status
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.id IS NULL
      AND UPPER(o.status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    console.log("Orders with NO items:", noItems.rows);

    // 2. Orders where items sum to 0
    const zeroSum = await client.query(`
      SELECT o.tid, o.total_cents, (SELECT SUM(price_cents * quantity) FROM order_items WHERE order_id = o.id) as sum
      FROM orders o
      WHERE UPPER(o.status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
      AND (SELECT SUM(price_cents * quantity) FROM order_items WHERE order_id = o.id) = 0
    `);
    console.log("Orders with 0 item sum:", zeroSum.rows);

    // 3. Orders with items but many are orphaned
    const orphaned = await client.query(`
      SELECT o.tid, o.total_cents, 
        (SELECT SUM(price_cents * quantity) FROM order_items WHERE order_id = o.id) as total_items_sum,
        (SELECT SUM(oi.price_cents * oi.quantity) FROM order_items oi LEFT JOIN global_products gp ON oi.global_product_id = gp.id WHERE oi.order_id = o.id AND gp.id IS NULL) as orphaned_sum
      FROM orders o
      WHERE UPPER(o.status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    
    let totalOrphaned = 0;
    for (const row of orphaned.rows) {
        if (row.orphaned_sum > 0) {
            console.log(`TID ${row.tid}: Total Items Sum ${row.total_items_sum}, Orphaned Sum ${row.orphaned_sum}`);
            totalOrphaned += Number(row.orphaned_sum);
        }
    }
    console.log("Total Orphaned Revenue:", totalOrphaned / 100);

  } finally {
    await client.end();
  }
}

check();
