
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- User Info for tahazaheer12 ---");
        const res = await pool.query(`
            SELECT u.email, u.role, u.organization_id, o.name as org_name 
            FROM users u 
            LEFT JOIN organizations o ON u.organization_id = o.id 
            WHERE u.email ILIKE '%tahazaheer12%'
        `);
        console.table(res.rows);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

run();
