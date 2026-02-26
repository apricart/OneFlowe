
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const orgId = 4; // 'Systems ltd'
        console.log(`--- Inventory for Org ID ${orgId} ---`);
        const res = await pool.query(`
            SELECT 
                oi.is_active as org_active,
                gp.name as product_name, 
                gp.product_code,
                gp.status as global_status
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.organization_id = 4 AND oi.deleted_at IS NULL
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
