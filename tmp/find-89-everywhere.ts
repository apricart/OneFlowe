
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Searching for active assignment of product '89' ---");
        const res = await pool.query(`
            SELECT 
                o.id as org_id, 
                o.name as org_name,
                oi.is_active, 
                gp.name as product_name, 
                gp.product_code,
                gp.status as global_status,
                oi.deleted_at as oi_deleted,
                gp.deleted_at as gp_deleted
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            JOIN organizations o ON oi.organization_id = o.id
            WHERE gp.name ILIKE '%89%'
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
