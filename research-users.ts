import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        // 1. Find organizations matching 'S'
        const orgs = await client.query("SELECT id, name FROM organizations WHERE name ILIKE '%S%'");
        console.log('Organizations matching S:', orgs.rows);

        // 2. Roles
        const roles = await client.query("SELECT id, name FROM roles");
        console.log('Roles:', roles.rows);

        // 3. Current users
        const usersList = await client.query("SELECT id, email, organization_id, role_id FROM users WHERE email IN ($1, $2)", ['admin@example.com', 'tahazaheer12@gmail.com']);
        console.log('Users found:', usersList.rows);

        // 4. Employee credentials
        const empCreds = await client.query("SELECT id, email FROM employee_credentials WHERE email IN ($1, $2)", ['admin@example.com', 'tahazaheer12@gmail.com']);
        console.log('Employee credentials found:', empCreds.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
