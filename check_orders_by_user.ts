import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        const ordersCount = await client.query("SELECT count(*) FROM orders");
        console.log('Total Orders:', ordersCount.rows[0].count);

        const ordersByUser = await client.query("SELECT created_by_user_id, count(*) FROM orders GROUP BY created_by_user_id");
        console.log('Orders by User ID:', ordersByUser.rows);

        const usersList = await client.query("SELECT id, email FROM users");
        console.log('Users in DB:', usersList.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
