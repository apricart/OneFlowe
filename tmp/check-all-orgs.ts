
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- All Organizations with exact names ---");
        const orgRes = await pool.query("SELECT id, name FROM organizations");
        orgRes.rows.forEach(r => console.log(`ID: ${r.id}, Name: '${r.name}'`));

        console.log("\n--- Searching for 'ABC Juice' in all orgs ---");
        const abcRes = await pool.query(`
            SELECT 
                oi.organization_id, 
                o.name as org_name,
                oi.is_active, 
                gp.name as product_name
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            JOIN organizations o ON oi.organization_id = o.id
            WHERE gp.name ILIKE '%ABC Juice%' AND oi.deleted_at IS NULL
        `);
        console.table(abcRes.rows);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
