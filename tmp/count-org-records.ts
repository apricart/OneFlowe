
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const orgId = 1;
        console.log(`--- ALL records in organization_inventory for Org ${orgId} ---`);
        const res = await pool.query(`
            SELECT 
                oi.id as oi_id,
                oi.global_product_id as gp_id,
                gp.name,
                gp.product_code,
                gp.status as gp_status,
                gp.deleted_at as gp_deleted,
                oi.is_active as oi_active,
                oi.assigned_at,
                oi.deleted_at as oi_deleted
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.organization_id = $1
            ORDER BY oi.assigned_at DESC
        `, [orgId]);
        console.table(res.rows);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
