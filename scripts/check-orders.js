const { Pool } = require('pg');
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.csxwfjwytobgzrtt',
  password: 'fv9g!Kp8?,/$tDk',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    await client.query('SET SESSION row_security = off');
    const result = await client.query('SELECT MIN(created_at) as min_date, MAX(created_at) as max_date, COUNT(*) as total FROM orders');
    console.log('DATA RANGE:', JSON.stringify(result.rows[0], null, 2));
    const years = await client.query('SELECT EXTRACT(YEAR FROM created_at) as year, COUNT(*) as cnt FROM orders GROUP BY 1 ORDER BY 1');
    console.log('BY YEAR:', JSON.stringify(years.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}
check().catch(e => { console.error(e); process.exit(1); });
