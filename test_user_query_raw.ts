import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        const startDate = '2000-01-01 00:00:00';
        const endDate = '2026-03-31 23:59:59';

        // 1. Get all branch IDs
        const branchesRes = await client.query("SELECT id FROM branches");
        const branchIds = branchesRes.rows.map(r => r.id);
        console.log('Branch IDs:', branchIds);

        if (branchIds.length === 0) {
            console.log("No branches found.");
            return;
        }

        // 2. Replicate the User Performance Query
        const sql = `
            SELECT 
                u.id as "userId",
                u.full_name as "userName",
                u.email as "userEmail",
                u.employee_id as "employeeId",
                b.name as "branchName",
                count(o.id) as "totalOrders",
                count(CASE WHEN o.status IN ('FULFILLED', 'APPROVED') THEN 1 END) as "fulfilledOrders",
                count(CASE WHEN o.status = 'REFUNDED' THEN 1 END) as "refundedOrders",
                sum(CASE WHEN o.status IN ('FULFILLED', 'APPROVED') THEN o.total_cents ELSE 0 END) as "totalSpentCents"
            FROM users u
            INNER JOIN orders o ON o.created_by_user_id = u.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE 
                o.branch_id = ANY($1::int[]) AND
                o.created_at >= $2 AND
                o.created_at <= $3
            GROUP BY u.id, b.name
            ORDER BY sum(CASE WHEN o.status IN ('FULFILLED', 'APPROVED') THEN o.total_cents ELSE 0 END) DESC
        `;

        const res = await client.query(sql, [branchIds, startDate, endDate]);
        console.log('Query Result Count:', res.rowCount);
        if (res.rowCount && res.rowCount > 0) {
            console.log('Sample Results:', res.rows.slice(0, 5));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
