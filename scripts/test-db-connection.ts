import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

async function testConnection() {
    config({ path: resolve(process.cwd(), '.env.test') });
    const connectionString = process.env.DATABASE_URL;
    console.log('Testing connection to:', connectionString);

    const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });

    try {
        const client = await pool.connect();
        console.log('✅ Successfully connected to database!');
        const res = await client.query('SELECT current_database(), current_user');
        console.log('Database Info:', res.rows[0]);
        client.release();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    } finally {
        await pool.end();
    }
}

testConnection();
