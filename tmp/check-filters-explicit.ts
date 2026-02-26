
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
        console.log("--- Checking join results for Org 1 ---");
        const res = await pool.query(`
            SELECT 
                oi.id as oi_id,
                oi.global_product_id as gp_id,
                gp.name as gp_name,
                oi.deleted_at as oi_del,
                gp.deleted_at as gp_del,
                gp.status as gp_status
            FROM organization_inventory oi
            LEFT JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.organization_id = $1
        `, [orgId]);

        console.table(res.rows.map(r => ({
            ...r,
            passes_oi_del: r.oi_del === null,
            passes_gp_del: r.gp_del === null,
            passes_gp_status: r.gp_status === 'active'
        })));

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
