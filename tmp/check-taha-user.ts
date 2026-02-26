
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Finding info for tahazaheer12 ---");
        const userRes = await pool.query("SELECT id, email, organization_id FROM users WHERE email ILIKE '%tahazaheer12%'");
        console.table(userRes.rows);

        if (userRes.rows.length > 0) {
            const orgId = userRes.rows[0].organization_id;
            console.log(`\n--- Org ID for user: ${orgId} ---`);
            const orgRes = await pool.query("SELECT name FROM organizations WHERE id = $1", [orgId]);
            console.table(orgRes.rows);

            console.log(`\n--- Inventory for Org ID ${orgId} ---`);
            const invRes = await pool.query(`
                SELECT 
                    oi.id, 
                    gp.name, 
                    gp.product_code, 
                    gp.status as gp_status, 
                    gp.deleted_at as gp_deleted,
                    oi.is_active as oi_active, 
                    oi.deleted_at as oi_deleted
                FROM organization_inventory oi
                JOIN global_products gp ON oi.global_product_id = gp.id
                WHERE oi.organization_id = $1
            `, [orgId]);
            console.table(invRes.rows);
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
