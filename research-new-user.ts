import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        // 1. Check user
        const userRes = await client.query("SELECT id, email, organization_id, branch_id FROM users WHERE email = $1", ['memonuzair331@gmail.com']);
        console.log('User found:', userRes.rows);

        // 2. Roles (already know but double check)
        const roles = await client.query("SELECT id, name FROM roles");
        console.log('Roles:', roles.rows);

        // 3. Organizations and their Branches
        const orgs = await client.query("SELECT id, name FROM organizations");
        console.log('Organizations:', orgs.rows);

        const branches = await client.query("SELECT id, name, organization_id FROM branches");
        console.log('Branches:', branches.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
