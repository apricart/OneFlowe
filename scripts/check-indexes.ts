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
    
    const indexesQuery = `
      SELECT 
        t.relname AS table_name,
        i.relname AS index_name, 
        a.attname AS column_name
      FROM 
        pg_class t, 
        pg_class i, 
        pg_index ix, 
        pg_attribute a,
        pg_namespace n
      WHERE 
        t.oid = ix.indrelid 
        AND i.oid = ix.indexrelid 
        AND a.attrelid = t.oid 
        AND a.attnum = ANY(ix.indkey) 
        AND t.relkind = 'r' 
        AND t.relnamespace = n.oid
        AND n.nspname = 'public'
        AND ix.indisunique = true
        AND t.relname IN ('users', 'employee_credentials')
        AND ix.indisprimary = false;
    `;
    const res = await client.query(indexesQuery);
    console.table(res.rows);
    fs.writeFileSync('unique_indexes_check.txt', JSON.stringify(res.rows, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkDb();
