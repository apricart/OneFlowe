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
      SELECT count(*) 
      FROM orders 
      WHERE branch_id = (SELECT id FROM branches WHERE name = 'Faisal Branch') 
      AND UPPER(status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    console.log("Faisal Branch Orders Count:", res.rows[0].count);
    
    const revRes = await client.query(`
      SELECT SUM(total_cents - COALESCE(refund_amount_cents, 0)) as total
      FROM orders 
      WHERE branch_id = (SELECT id FROM branches WHERE name = 'Faisal Branch') 
      AND UPPER(status) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')
    `);
    console.log("Faisal Branch Net Revenue:", revRes.rows[0].total / 100);

  } finally {
    await client.end();
  }
}

check();
