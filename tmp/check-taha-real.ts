
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- User Role and Org for tahazaheer12 ---");
        const res = await pool.query(`
            SELECT u.email, r.name as role_name, u.organization_id, o.name as org_name
            FROM users u 
            JOIN roles r ON u.role_id = r.id 
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.email ILIKE '%tahazaheer12%'
        `);
        console.table(res.rows);

        if (res.rows.length > 0) {
            const orgId = res.rows[0].organization_id;
            console.log(`\n--- Active Inventory for Org ${orgId} ---`);
            const invRes = await pool.query(`
                SELECT gp.name, oi.is_active, gp.status as global_status
                FROM organization_inventory oi
                JOIN global_products gp ON oi.global_product_id = gp.id
                WHERE oi.organization_id = $1 AND oi.deleted_at IS NULL AND gp.deleted_at IS NULL
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
