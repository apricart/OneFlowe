
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const orgId = 1; // 'S'
        console.log(`--- Checking organization_products for Org ID ${orgId} ---`);
        const res = await pool.query(`
            SELECT 
                op.id as op_id,
                op.global_product_id,
                op.is_enabled,
                gp.name as product_name,
                gp.product_code,
                gp.status as global_status
            FROM organization_products op
            JOIN global_products gp ON op.global_product_id = gp.id
            WHERE op.organization_id = $1
        `, [orgId]);
        console.table(res.rows);

        console.log("\n--- Checking matches for 'ABC Juice' globally in organization_products ---");
        const abcRes = await pool.query(`
            SELECT 
                op.organization_id, 
                o.name as org_name,
                op.is_enabled, 
                gp.name as product_name
            FROM organization_products op
            JOIN global_products gp ON op.global_product_id = gp.id
            JOIN organizations o ON op.organization_id = o.id
            WHERE gp.name ILIKE '%ABC Juice%'
        `);
        console.table(abcRes.rows);

    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
