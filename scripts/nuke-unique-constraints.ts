import { Client } from 'pg';

async function nukeUniqueIndexes() {
  const connectionString = "postgresql://postgres.ofqbofqxvztwmhsezrpv:Hitandrun%40%3F%3F123@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Find all unique indexes that are not primary keys and not for username
    const query = `
      SELECT 
        i.relname AS index_name,
        t.relname AS table_name
      FROM 
        pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE 
        n.nspname = 'public'
        AND t.relname IN ('users', 'employee_credentials')
        AND ix.indisunique = true
        AND ix.indisprimary = false
        AND i.relname NOT LIKE '%username%';
    `;
    const res = await client.query(query);
    
    for (const row of res.rows) {
      console.log(`Dropping unique index ${row.index_name} on ${row.table_name}...`);
      await client.query(`DROP INDEX IF EXISTS "public"."${row.index_name}" CASCADE;`);
      
      // Re-create as a standard non-unique index to maintain performance
      // We'll guess the column name from the index name if possible, or just skip it if it's too complex
      // Actually, it's safer to just drop them and let drizzle re-generate standard indexes if needed.
    }

    // Also explicitly drop the ones we know about for sure
    await client.query('DROP INDEX IF EXISTS "users_email_idx" CASCADE');
    await client.query('DROP INDEX IF EXISTS "users_employee_id_idx" CASCADE');
    await client.query('DROP INDEX IF EXISTS "employee_creds_email_uq" CASCADE');
    
    // Create non-unique indexes
    await client.query('CREATE INDEX IF NOT EXISTS "users_email_idx" ON "public"."users" ("email")');
    await client.query('CREATE INDEX IF NOT EXISTS "users_employee_id_idx" ON "public"."users" ("employee_id")');
    await client.query('CREATE INDEX IF NOT EXISTS "employee_creds_email_idx" ON "public"."employee_credentials" ("email")');

    console.log("Database unique constraints sanitized. ONLY username remains unique.");
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

nukeUniqueIndexes();
