import { Client } from 'pg';

async function checkTriggers() {
  const connectionString = "postgresql://postgres.ofqbofqxvztwmhsezrpv:Hitandrun%40%3F%3F123@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const query = `
      SELECT 
        trigger_name, 
        event_manipulation, 
        event_object_table, 
        action_statement 
      FROM information_schema.triggers 
      WHERE event_object_table = 'users';
    `;
    const res = await client.query(query);
    console.table(res.rows);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkTriggers();
