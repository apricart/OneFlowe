import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        // 1. Find Branch 'Malir Halt'
        const branches = await client.query("SELECT id, name, organization_id FROM branches WHERE name ILIKE '%Malir Halt%'");
        console.log('Branches matching Malir Halt:', branches.rows);

        // 2. Roles (to confirm BRANCH_ADMIN ID)
        const roles = await client.query("SELECT id, name FROM roles WHERE name = 'BRANCH_ADMIN'");
        console.log('Role BRANCH_ADMIN:', roles.rows);

        // 3. User check
        const user = await client.query("SELECT id, email FROM users WHERE email = $1", ['memonuzair331@gmail.com']);
        console.log('Existing user check:', user.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
