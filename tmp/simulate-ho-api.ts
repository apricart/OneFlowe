
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const organizationId = 1;
        const search = "";
        const category = "";
        const subCategory = "";
        const status = "";

        console.log(`--- Simulating HO API for Org ${organizationId} ---`);

        // This is a direct translation of the Drizzle query in route.ts
        const query = `
            SELECT 
                oi.id,
                gp.name as productName,
                gp.product_code as productCode,
                gp.status as globalStatus,
                oi.is_active as isActive,
                oi.deleted_at as oiDeleted,
                gp.deleted_at as gpDeleted
            FROM organization_inventory oi
            LEFT JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE 
                oi.organization_id = $1
                AND oi.deleted_at IS NULL
                AND gp.deleted_at IS NULL
                AND gp.status = 'active'
                AND oi.is_active = TRUE
        `;

        const res = await pool.query(query, [organizationId]);
        console.log(`Total items found by simulated query: ${res.rows.length}`);
        console.table(res.rows);

        // Check each product from SA screenshot
        const expected = ['sadaddas', 'Fries', 'ABC Juice', 'Tang'];
        for (const name of expected) {
            const match = res.rows.find(r => r.productname.includes(name));
            console.log(`Product '${name}': ${match ? 'FOUND' : 'MISSING'}`);
            if (!match) {
                // Why is it missing? Check the raw data for this specific product
                console.log(`  Checking raw data for '${name}'...`);
                const raw = await pool.query(`
                    SELECT gp.status, gp.deleted_at as gp_del, oi.deleted_at as oi_del, oi.organization_id
                    FROM organization_inventory oi
                    JOIN global_products gp ON oi.global_product_id = gp.id
                    WHERE gp.name ILIKE $1 AND oi.organization_id = $2
                `, [`%${name}%`, organizationId]);
                console.table(raw.rows);
            }
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
