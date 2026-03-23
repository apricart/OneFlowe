const { Client } = require('pg');

async function test() {
  const client = new Client({
    connectionString: "postgresql://postgres.gkhrumlxtrydbtnyeyts:RedzoEbad!123@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  const branchIds = [1, 2, 64];
  const periodList = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];

  console.log("Testing query with branches:", branchIds, "and periods:", periodList);

  const query = `
    SELECT id, branch_id, period, amount_allocated_cents, amount_spent_cents 
    FROM budgets 
    WHERE branch_id = ANY($1) AND period = ANY($2)
  `;
  
  const res = await client.query(query, [branchIds, periodList]);
  console.log("Results found:", res.rowCount);
  console.table(res.rows);

  await client.end();
}

test();
