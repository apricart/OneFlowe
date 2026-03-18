import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        const ordersByBranch = await client.query("SELECT branch_id, count(*) FROM orders GROUP BY branch_id");
        console.log('Orders by Branch ID:', ordersByBranch.rows);

        const branchesList = await client.query("SELECT id, name, organization_id FROM branches");
        console.log('Branches in DB:', branchesList.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
