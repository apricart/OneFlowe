
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
        console.log(`--- Deep Inspection for Org ID ${orgId} ---`);
        const res = await pool.query(`
            SELECT 
                oi.id as oi_id,
                oi.global_product_id,
                oi.is_active as oi_active,
                oi.deleted_at as oi_deleted,
                gp.name as gp_name,
                gp.product_code,
                gp.status as gp_status,
                gp.deleted_at as gp_deleted,
                gp.category_id
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.organization_id = $1
        `, [orgId]);

        console.table(res.rows.map(r => ({
            ...r,
            gp_name: `'${r.gp_name}'`, // Show spaces
            gp_status: `'${r.gp_status}'`
        })));

    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
