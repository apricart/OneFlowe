
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
        const productCodes = ['0001111', 'PRE-221', 'PRD-190', 'PRD-004', 'PRD-001'];

        console.log(`--- Diagnostics for Org ID ${orgId} and specific products ---`);
        const res = await pool.query(`
            SELECT 
                gp.id as gp_id,
                gp.name as gp_name,
                gp.product_code,
                gp.status as gp_status,
                gp.deleted_at as gp_deleted,
                oi.id as oi_id,
                oi.is_active as oi_active,
                oi.deleted_at as oi_deleted
            FROM global_products gp
            LEFT JOIN organization_inventory oi ON gp.id = oi.global_product_id AND oi.organization_id = $1
            WHERE gp.product_code = ANY($2)
        `, [orgId, productCodes]);

        console.table(res.rows);

        // Also check if there are other records for these same products with maybe different codes or names?
        console.log("\n--- Checking for products by name to see if codes differ ---");
        const names = ['sadaddas', 'Fries', 'mango juicsdsdsde', 'ABC Juice', 'Tang'];
        const resNames = await pool.query(`
            SELECT 
                gp.id as gp_id,
                gp.name as gp_name,
                gp.product_code,
                gp.status as gp_status,
                gp.deleted_at as gp_deleted,
                oi.organization_id,
                oi.is_active as oi_active,
                oi.deleted_at as oi_deleted
            FROM global_products gp
            LEFT JOIN organization_inventory oi ON gp.id = oi.global_product_id
            WHERE (gp.name ILIKE ANY($1) OR gp.name ILIKE '%ABC Juice%')
        `, [names.map(n => `%${n}%`)]);
        console.table(resNames.rows);

    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
