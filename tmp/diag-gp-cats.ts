
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const ids = [36, 10, 3, 2];
        console.log("--- Category IDs for specific products ---");
        const res = await pool.query("SELECT id, name, category_id FROM global_products WHERE id = ANY($1)", [ids]);
        console.table(res.rows);

        const catIds = res.rows.map(r => r.category_id).filter(Boolean);
        if (catIds.length > 0) {
            console.log("\n--- Category names ---");
            const catRes = await pool.query("SELECT id, name, parent_id FROM categories WHERE id = ANY($1)", [catIds]);
            console.table(catRes.rows);

            const parentIds = catRes.rows.map(r => r.parent_id).filter(Boolean);
            if (parentIds.length > 0) {
                console.log("\n--- Parent Category names ---");
                const parentRes = await pool.query("SELECT id, name FROM categories WHERE id = ANY($1)", [parentIds]);
                console.table(parentRes.rows);
            }
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
