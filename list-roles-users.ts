import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("--- Roles ---");
        const roles = await client.query('SELECT * FROM roles');
        console.log(JSON.stringify(roles.rows, null, 2));

        console.log("\n--- Users (admin related) ---");
        const users = await client.query("SELECT id, email, first_name, last_name, role_id FROM users WHERE email LIKE '%admin%' OR first_name ILIKE '%admin%' OR last_name ILIKE '%admin%'");
        console.log(JSON.stringify(users.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
