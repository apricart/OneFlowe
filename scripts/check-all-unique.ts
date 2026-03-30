import { Client } from 'pg';
import fs from 'fs';

async function checkDb() {
  const connectionString = "postgresql://postgres.ofqbofqxvztwmhsezrpv:Hitandrun%40%3F%3F123@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Get ALL unique indexes in the entire database for our target tables
    const query = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM 
        pg_indexes 
      WHERE 
        (tablename = 'users' OR tablename = 'employee_credentials')
        AND indexdef LIKE '%UNIQUE%';
    `;
    const res = await client.query(query);
    console.table(res.rows);
    fs.writeFileSync('all_unique_indexes.txt', JSON.stringify(res.rows, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkDb();
