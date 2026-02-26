
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Searching for Branch 'Malir Halt Branch' ---");
        const branchRes = await pool.query(`
            SELECT b.id, b.name, b.organization_id, o.name as org_name 
            FROM branches b 
            JOIN organizations o ON b.organization_id = o.id 
            WHERE b.name ILIKE '%Malir Halt Branch%'
        `);
        console.table(branchRes.rows);

        if (branchRes.rows.length > 0) {
            const orgId = branchRes.rows[0].organization_id;
            console.log(`\n--- Inventory for Correct Org ID ${orgId} (${branchRes.rows[0].org_name}) ---`);
            const inv = await pool.query(`
                SELECT 
                    oi.id, 
                    oi.is_active as org_active, 
                    gp.id as gp_id,
                    gp.name as product_name, 
                    gp.product_code,
                    gp.status as global_status
                FROM organization_inventory oi
                JOIN global_products gp ON oi.global_product_id = gp.id
                WHERE oi.organization_id = $1 AND oi.deleted_at IS NULL
            `, [orgId]);
            console.table(inv.rows);
        }
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
