import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'");
        console.log('Columns in public.users table:', res.rows.map(r => r.column_name));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
