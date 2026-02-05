import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        const tables = ['orders', 'branch_inventory', 'audit_logs', 'system_logs'];
        for (const table of tables) {
            const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
            console.log(`Columns in ${table}:`, cols.rows.map(r => r.column_name));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
