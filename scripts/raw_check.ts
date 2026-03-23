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
    const res = await client.query('SELECT status, count(*) FROM orders GROUP BY status');
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await client.end();
  }
}

check();
