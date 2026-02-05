import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();

        const adminEmail = 'admin@example.com';
        const [adminUser] = (await client.query('SELECT id FROM users WHERE email = $1', [adminEmail])).rows;

        if (adminUser) {
            const adminId = adminUser.id;
            console.log(`Clearing records for User ID: ${adminId} (${adminEmail})`);

            // 1. Delete from audit_logs
            await client.query('DELETE FROM audit_logs WHERE user_id = $1', [adminId]);
            console.log('Cleared audit_logs');

            // 2. Delete from system_logs (if different)
            try {
                await client.query('DELETE FROM system_logs WHERE user_id = $1', [adminId]);
                console.log('Cleared system_logs');
            } catch (e) { }

            // 3. Delete from user_roles
            try {
                await client.query('DELETE FROM user_roles WHERE user_id = $1', [adminId]);
            } catch (e) { }

            // 4. Finally delete the user
            await client.query('DELETE FROM users WHERE id = $1', [adminId]);
            console.log(`Successfully deleted user ${adminEmail}`);
        } else {
            console.log(`User ${adminEmail} not found.`);
        }

    } catch (err) {
        console.error('Final cleanup failed:', err);
    } finally {
        await client.end();
    }
}

run();
