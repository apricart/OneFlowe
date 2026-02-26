
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function query() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- All Organizations ---");
        const orgRes = await pool.query("SELECT id, name FROM organizations");
        console.table(orgRes.rows);

        console.log("\n--- Checking inventories for all organizations named like 'S' ---");
        const sOrgs = orgRes.rows.filter(o => o.name.toLowerCase().includes('s'));
        for (const org of sOrgs) {
            console.log(`\nInventory for Org ID ${org.id} (${org.name}):`);
            const inv = await pool.query(`
                SELECT 
                    oi.id, 
                    oi.is_active, 
                    gp.name as product_name, 
                    gp.product_code,
                    gp.status as global_status
                FROM organization_inventory oi
                JOIN global_products gp ON oi.global_product_id = gp.id
                WHERE oi.organization_id = $1 AND oi.deleted_at IS NULL
            `, [org.id]);
            console.table(inv.rows);
        }

    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        await pool.end();
    }
}

query();
