import * as fs from 'fs';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const data = JSON.parse(fs.readFileSync('refined_audit.json', 'utf8'));
  const tids = data.discrepancies.map((d: any) => d.tid);
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    const res = await client.query('SELECT tid, status FROM orders WHERE tid = ANY($1)', [tids]);
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await client.end();
  }
}

check();
