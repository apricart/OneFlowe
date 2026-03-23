const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://postgres.gkhrumlxtrydbtnyeyts:root@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("--- ORGANIZATIONS ---");
  const orgs = await client.query("SELECT id, name FROM organizations");
  console.table(orgs.rows);

  console.log("--- ALL BRANCHES ---");
  const branches = await client.query("SELECT id, name, organization_id FROM branches");
  console.table(branches.rows);

  await client.end();
}

check();
