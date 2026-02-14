import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DATABASE_URL found');

    const client = new Client({ connectionString });

    try {
        await client.connect();

        console.log('--- Checking Organization 29 ---');
        const orgRes = await client.query("SELECT * FROM organizations WHERE id = 29");
        console.log(orgRes.rows);

        console.log('--- Checking Branch 37 ---');
        const branchRes = await client.query("SELECT * FROM branches WHERE id = 37");
        console.log(branchRes.rows);

        console.log('--- Checking Roles ---');
        const rolesRes = await client.query("SELECT * FROM roles");
        console.log(rolesRes.rows);

        console.log('--- Checking for Duplicate Email ---');
        const userRes = await client.query("SELECT id, email FROM users WHERE email = $1", ['tahazaheedr12@gmail.com']);
        console.log(userRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
