
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const orgId = 33;
        console.log(`--- Inventory for Org ID ${orgId} ---`);
        const res = await pool.query(`
            SELECT 
                oi.id, 
                gp.name as product_name, 
                oi.is_active, 
                gp.status as global_status,
                gp.deleted_at as gp_deleted,
                oi.deleted_at as oi_deleted
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.organization_id = $1
        `, [orgId]);
        console.table(res.rows);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
