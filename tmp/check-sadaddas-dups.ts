
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- All global_products matching 'sadaddas' ---");
        const res = await pool.query("SELECT id, name, product_code, status, deleted_at FROM global_products WHERE name ILIKE '%sadaddas%'");
        console.table(res.rows);

        console.log("\n--- Assignments for these duplicates ---");
        const ids = res.rows.map(r => r.id);
        const invRes = await pool.query(`
            SELECT oi.id, oi.organization_id, o.name as org_name, oi.global_product_id, oi.is_active, oi.deleted_at
            FROM organization_inventory oi
            JOIN organizations o ON oi.organization_id = o.id
            WHERE oi.global_product_id = ANY($1)
        `, [ids]);
        console.table(invRes.rows);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
