import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        console.log('Connected to DB. Adding employee_id column to users table...');

        const checkColumn = await client.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'employee_id'");
        
        if (checkColumn.rowCount === 0) {
            await client.query("ALTER TABLE users ADD COLUMN employee_id VARCHAR(64)");
            console.log('Column employee_id added successfully.');
        } else {
            console.log('Column employee_id already exists.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

run();
