
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
        console.log("--- Checking length and value of status ---");
        const res = await pool.query("SELECT id, name, status, length(status) as status_len FROM global_products WHERE id = ANY($1)", [ids]);
        console.table(res.rows);

        console.log("\n--- Checking for trailing spaces in names too ---");
        const resNames = await pool.query("SELECT id, name, length(name) as name_len FROM global_products WHERE id = ANY($1)", [ids]);
        console.table(resNames.rows);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
