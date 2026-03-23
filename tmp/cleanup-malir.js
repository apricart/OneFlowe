const { Client } = require('pg');

async function cleanup() {
  const client = new Client({
    connectionString: "postgresql://postgres.gkhrumlxtrydbtnyeyts:root@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("Starting cleanup for Malir Halt (Branch 1) in Org 1...");

  // Select records to be deleted for verification
  const toDelete = await client.query(`
    SELECT id, period, amount_allocated_cents, amount_spent_cents 
    FROM budgets 
    WHERE branch_id = 1 AND period < '2026-03'
  `);

  console.log("Found records to delete:", toDelete.rows);

  if (toDelete.rows.length > 0) {
    const ids = toDelete.rows.map(r => r.id);
    const deleteRes = await client.query(`DELETE FROM budgets WHERE id = ANY($1)`, [ids]);
    console.log(`Successfully deleted ${deleteRes.rowCount} historical records.`);
  } else {
    console.log("No historical records found to delete.");
  }

  // Also check if there are any other branches that need cleanup in Org 1
  // The user only asked for Malir Halt, but I'll check first.
  const others = await client.query(`
    SELECT id, branch_id, period, amount_spent_cents 
    FROM budgets 
    WHERE organization_id = 1 AND period < '2026-03' AND amount_spent_cents > 0
  `);
  
  if (others.rows.length > 0) {
     console.log("⚠️ Found other historical records with spending in Org 1:", others.rows);
     // I won't delete them yet since the user only asked for Malir Halt.
  }

  await client.end();
}

cleanup();
