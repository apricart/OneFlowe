const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://postgres.gkhrumlxtrydbtnyeyts:RedzoEbad!123@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  const res = await client.query("SELECT id, name FROM organizations");
  console.table(res.rows);
  await client.end();
}
check();
