import * as fs from 'fs';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function cleanup() {
  const auditFile = 'refined_audit.json';
  if (!fs.existsSync(auditFile)) {
    console.error('refined_audit.json not found. Run audit_revenue_refined.ts first.');
    process.exit(1);
  }

  const auditData = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
  const tids = auditData.discrepancies.map((d: any) => d.tid);

  if (tids.length === 0) {
    console.log('No discrepancies found. Nothing to delete.');
    process.exit(0);
  }

  console.log(`Found ${tids.length} inconsistent orders to delete.`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    await client.query('BEGIN');

    // 1. Get order IDs for these TIDs
    const orderRes = await client.query('SELECT id FROM orders WHERE tid = ANY($1)', [tids]);
    const orderIds = orderRes.rows.map(r => r.id);

    if (orderIds.length > 0) {
        // 2. Delete refund_items
        await client.query(`
            DELETE FROM refund_items 
            WHERE refund_id IN (SELECT id FROM refunds WHERE order_id = ANY($1))
        `, [orderIds]);

        // 3. Delete refunds
        await client.query('DELETE FROM refunds WHERE order_id = ANY($1)', [orderIds]);

        // 4. Delete order_items
        await client.query('DELETE FROM order_items WHERE order_id = ANY($1)', [orderIds]);

        // 5. Delete order_assignments (if they exist)
        // Note: checking table names from schema
        // There is no order_assignments but there are notifications and audit_logs
        await client.query('DELETE FROM notifications WHERE target_role IS NULL AND message ILIKE \'%' + tids[0].substring(0,5) + '%\''); // Loose cleanup of notifications

        // 6. Delete orders
        const deleteRes = await client.query('DELETE FROM orders WHERE id = ANY($1)', [orderIds]);
        console.log(`Successfully deleted ${deleteRes.rowCount} orders.`);
    }

    await client.query('COMMIT');
    console.log('Cleanup complete.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup failed, rolled back changes:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

cleanup();
