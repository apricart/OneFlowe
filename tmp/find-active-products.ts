
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Non-Deleted Global Products ---");
        const res = await pool.query(`
            SELECT id, name, product_code, status, deleted_at 
            FROM global_products 
            WHERE deleted_at IS NULL
        `);
        console.table(res.rows);

        console.log("\n--- Checking matches for '89', 'Fries', 'Tang', 'ABC Juice' ---");
        const names = ['89', 'Fries', 'Tang', 'ABC Juice'];
        const matches = res.rows.filter(r => names.some(n => r.name.includes(n)));
        console.table(matches);

    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
