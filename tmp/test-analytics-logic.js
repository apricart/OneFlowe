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

  // Simulate API parameters for Mar 2026 for Malir Halt (ID 1)
  const branchIds = [1];
  const startDate = '2026-03-01';
  const endDate = '2026-03-31';

  // 1. Fetch branch
  const branchRes = await client.query("SELECT id, name, baseline_budget_cents FROM branches WHERE id = ANY($1)", [branchIds]);
  console.log("Branches:", branchRes.rows);

  // 2. Fetch budgets for the period
  const period = '2026-03';
  const budgetRes = await client.query(`
    SELECT * FROM budgets 
    WHERE branch_id = ANY($1) AND period = $2
  `, [branchIds, period]);
  console.log("Budget Records for Mar 2026:");
  console.table(budgetRes.rows);

  // 3. Fetch Category spending (This is what might be failing if it uses orders)
  const categoryRes = await client.query(`
    SELECT 
      SUM(oi.price_cents * oi.quantity) as spent
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN global_products gp ON oi.product_id = gp.id
    WHERE o.branch_id = ANY($1)
    AND o.created_at >= $2 AND o.created_at <= $3
    AND o.status = 'FULFILLED'
  `, [branchIds, startDate, endDate]);
  console.log("Category spending (total):", categoryRes.rows[0].spent || 0);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
