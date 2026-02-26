
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Finding Org 'S' ---");
        const orgRes = await pool.query("SELECT id, name FROM organizations WHERE name = 'S' OR name ILIKE '%S%' LIMIT 10");
        console.table(orgRes.rows);

        const orgId = 1; // Likely ID
        console.log(`\n--- Inventory for Org ID ${orgId} ---`);
        const invRes = await pool.query(`
            SELECT 
                oi.id as oi_id,
                gp.name as product_name,
                gp.product_code,
                gp.status as global_status,
                gp.deleted_at as gp_deleted,
                oi.is_active as oi_active,
                oi.deleted_at as oi_deleted
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.organization_id = $1
        `, [orgId]);
        console.table(invRes.rows);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
