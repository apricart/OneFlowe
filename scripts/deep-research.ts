import { Client } from 'pg';
import fs from 'fs';

async function research() {
  const connectionString = "postgresql://postgres.ofqbofqxvztwmhsezrpv:Hitandrun%40%3F%3F123@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // 1. Check all UNIQUE constraints (not just indexes)
    const constraintsQuery = `
      SELECT 
        conname, 
        contype, 
        pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid IN ('public.users'::regclass, 'public.employee_credentials'::regclass);
    `;
    const constraints = await client.query(constraintsQuery);
    
    // 2. Check all triggers
    const triggersQuery = `
      SELECT 
        tgname, 
        pg_get_triggerdef(oid) 
      FROM pg_trigger 
      WHERE tgrelid IN ('public.users'::regclass, 'public.employee_credentials'::regclass);
    `;
    const triggers = await client.query(triggersQuery);
    
    // 3. Check for any other tables named searchably
    const tablesQuery = `
      SELECT tablename, schemaname 
      FROM pg_tables 
      WHERE tablename LIKE '%user%' OR tablename LIKE '%employee%';
    `;
    const tables = await client.query(tablesQuery);

    fs.writeFileSync('research_results.txt', JSON.stringify({
      constraints: constraints.rows,
      triggers: triggers.rows,
      tables: tables.rows
    }, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

research();
