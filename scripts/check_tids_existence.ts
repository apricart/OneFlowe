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
    const tids = ['mluhmw2ld84gsdgd', 'mlugyt3hgnlqrxqn', 'mlqadj0i6tczsqd8', 'ml6g42z289j73lj6', 'mm0hd5t6y9ztp1is'];
    for (const tid of tids) {
        const res = await client.query('SELECT count(*) FROM orders WHERE tid = $1', [tid]);
        console.log(`Count for ${tid}: ${res.rows[0].count}`);
    }
  } finally {
    await client.end();
  }
}

check();
