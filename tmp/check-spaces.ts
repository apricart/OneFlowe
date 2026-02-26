
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Exact Status Check for 'ABC Juice' ---");
        const res = await pool.query("SELECT id, name, status, length(status) as status_len FROM global_products WHERE name ILIKE '%ABC Juice%'");
        res.rows.forEach(r => {
            console.log(`ID: ${r.id}, Name: '${r.name}', Status: '${r.status}', Status Length: ${r.status_len}`);
        });

        console.log("\n--- Exact Status Check for all active products in Org 1 ---");
        const invRes = await pool.query(`
            SELECT gp.id, gp.name, gp.status, length(gp.status) as status_len
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.organization_id = 1 AND oi.deleted_at IS NULL
        `);
        invRes.rows.forEach(r => {
            console.log(`GP ID: ${r.id}, Name: '${r.name}', Status: '${r.status}', Len: ${r.status_len}`);
        });

    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
