const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://postgres.gkhrumlxtrydbtnyeyts:RedzoEbad!123@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  console.log("--- ORGANIZATIONS ---");
  const orgs = await client.query("SELECT id, name FROM organizations");
  console.table(orgs.rows);

  console.log("--- KEY BRANCHES (MALIR & GULBERG) ---");
  const keyBranches = await client.query("SELECT id, name, organization_id FROM branches WHERE name ILIKE '%Malir%' OR name ILIKE '%Gulberg%'");
  console.table(keyBranches.rows);

  console.log("--- BUDGET RECORDS SAMPLE ---");
  const budgetSample = await client.query("SELECT id, branch_id, period, amount_allocated_cents, amount_spent_cents FROM budgets LIMIT 10");
  console.table(budgetSample.rows);

  await client.end();
}

check();
