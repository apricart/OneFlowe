
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Active Assignment Counts by Org ---");
        const res = await pool.query(`
            SELECT 
                oi.organization_id, 
                o.name as org_name,
                count(*) as active_count
            FROM organization_inventory oi
            JOIN organizations o ON oi.organization_id = o.id
            JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.is_active = true 
              AND oi.deleted_at IS NULL 
              AND gp.deleted_at IS NULL
              AND gp.status = 'active'
            GROUP BY oi.organization_id, o.name
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
