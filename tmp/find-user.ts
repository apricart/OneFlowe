
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Searching for user 'tahazaheer12' ---");
        const userRes = await pool.query("SELECT id, email, organization_id FROM users WHERE email ILIKE '%taha%'");
        console.table(userRes.rows);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
