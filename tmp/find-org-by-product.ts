
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Searching for Org with product '89' ---");
        const res = await pool.query(`
            SELECT 
                o.id as org_id, 
                o.name as org_name,
                oi.is_active as org_active,
                gp.name as product_name,
                gp.status as global_status
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            JOIN organizations o ON oi.organization_id = o.id
            WHERE gp.name ILIKE '%89%' AND oi.deleted_at IS NULL
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
