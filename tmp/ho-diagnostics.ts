
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function diagnose() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const orgId = 1; // 'S'
        console.log(`--- Diagnosing HO Inventory Logic for Org ID ${orgId} ---`);

        // 1. Get all assignments for this org (like SA does)
        const assignments = await pool.query(`
            SELECT 
                oi.id as oi_id,
                gp.id as gp_id,
                gp.name as product_name,
                gp.product_code,
                gp.status as global_status,
                oi.deleted_at as oi_deleted,
                gp.deleted_at as gp_deleted,
                oi.is_active as org_active
            FROM organization_inventory oi
            JOIN global_products gp ON oi.global_product_id = gp.id
            WHERE oi.organization_id = $1
        `, [orgId]);

        console.log(`Found ${assignments.rows.length} total assignments in DB for Org ${orgId}.`);

        for (const row of assignments.rows) {
            console.log(`\nProduct: ${row.product_name} (${row.product_code})`);

            const results = [];
            // Check filters used in GET /api/v1/head-office/organization-inventory

            const oiDeletedCheck = row.oi_deleted === null;
            results.push(`oi.deleted_at IS NULL: ${oiDeletedCheck} (${row.oi_deleted})`);

            const gpDeletedCheck = row.gp_deleted === null;
            results.push(`gp.deleted_at IS NULL: ${gpDeletedCheck} (${row.gp_deleted})`);

            const gpStatusCheck = row.global_status === 'active';
            results.push(`gp.status === 'active': ${gpStatusCheck} ('${row.global_status}')`);

            const willShowInHO = oiDeletedCheck && gpDeletedCheck && gpStatusCheck;
            console.log(`>> WILL SHOW IN HO: ${willShowInHO}`);
            results.forEach(r => console.log(`   ${r}`));
        }

    } catch (e) {
        console.error("Diagnosis failed:", e.message);
    } finally {
        await pool.end();
    }
}

diagnose();
