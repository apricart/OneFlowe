
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- All global_products matching 'ABC Juice' ---");
        const res = await pool.query("SELECT id, name, status, deleted_at FROM global_products WHERE name ILIKE '%ABC Juice%'");
        console.table(res.rows);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
