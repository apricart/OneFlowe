const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://postgres.gkhrumlxtrydbtnyeyts:root@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("--- BRANCH DETAILS ---");
  const branchRes = await client.query("SELECT id, name, organization_id FROM branches WHERE name ILIKE '%Malir Halt%'");
  console.table(branchRes.rows);

  if (branchRes.rows.length > 0) {
    const branchId = branchRes.rows[0].id;
    console.log(`--- BUDGET RECORDS FOR BRANCH ${branchId} ---`);
    const budgetRes = await client.query("SELECT id, organization_id, period, amount_allocated_cents FROM budgets WHERE branch_id = $1 ORDER BY period DESC", [branchId]);
    console.table(budgetRes.rows);
  }

  await client.end();
}

check();
