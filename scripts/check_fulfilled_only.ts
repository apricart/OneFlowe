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
      SELECT SUM(total_cents - COALESCE(refund_amount_cents, 0)) as total, count(*) 
      FROM orders 
      WHERE UPPER(status) = 'FULFILLED'
    `);
    console.log("Fulfilled Only Total:", res.rows[0].total / 100);
    console.log("Fulfilled Only Count:", res.rows[0].count);
    
    const approvedRes = await client.query(`
      SELECT SUM(total_cents - COALESCE(refund_amount_cents, 0)) as total, count(*) 
      FROM orders 
      WHERE UPPER(status) = 'APPROVED'
    `);
    console.log("Approved Only Total:", approvedRes.rows[0].total / 100);
    console.log("Approved Only Count:", approvedRes.rows[0].count);

  } finally {
    await client.end();
  }
}

check();
