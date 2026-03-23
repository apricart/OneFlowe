import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function wipe() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("--- DATABASE WIPE INITIATED ---");
  console.log("Target: All Orders and Budgets");

  await client.connect();
  try {
    await client.query('BEGIN');

    const tables = [
      'refund_items',
      'refunds',
      'order_items',
      'orders',
      'notifications',
      'audit_logs',
      'system_logs',
      'budget_addons',
      'budgets',
      'org_metrics',
      'group_audit_logs',
      'restock_requests'
    ];

    for (const table of tables) {
      console.log(`Clearing table: ${table}...`);
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    }

    await client.query('COMMIT');
    console.log("--- WIPE COMPLETE: ALL TABLES EMPTIED ---");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Wipe failed, safety rollback executed:", error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

// THIS SCRIPT IS DESTRUCTIVE. ONLY UNCOMMENT THE LINE BELOW IF YOU ARE 100% SURE.
wipe();
// console.log("Wipe script ready but NOT ARMED for safety. See implementation_plan.md.");
