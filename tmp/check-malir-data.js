const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = Object.fromEntries(
    envContent
      .split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const [key, ...rest] = line.split('=');
        let value = rest.join('=').trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );

  const client = new Client({
    connectionString: env.DIRECT_URL || env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log("Connected to database.");

  // 1. Check ALL budgets for Malir Halt Branch (ID 1 and 3)
  console.log("Checking budgets for Malir Halt (IDs 1, 3)...");
  const res = await client.query(`
    SELECT * FROM budgets 
    WHERE branch_id IN (1, 3) 
    ORDER BY period DESC
  `);
  console.table(res.rows);

  // 2. Check total spent and held from orders for March 2026 for Branch 1
  console.log("Checking March 2026 orders for Branch 1...");
  const orderRes = await client.query(`
    SELECT status, COUNT(*), SUM(total_cents) as total
    FROM orders
    WHERE branch_id = 1 AND TO_CHAR(created_at, 'YYYY-MM') = '2026-03'
    GROUP BY status
  `);
  console.table(orderRes.rows);

  // 3. Check what branches the analytics API would see for Org 1 (S)
  const branchesRes = await client.query(`
    SELECT b.id, b.name, b.status 
    FROM branches b 
    WHERE b.organization_id = 1
  `);
  console.log("Branches in Org 1:");
  console.table(branchesRes.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
