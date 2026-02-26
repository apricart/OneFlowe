
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- All Organizations ---");
        const orgRes = await pool.query("SELECT id, name FROM organizations ORDER BY id ASC");
        console.table(orgRes.rows);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
