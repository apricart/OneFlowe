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
        const targetEmail = 'tahazaheer12@gmail.com';

        const [adminUser] = (await client.query('SELECT id FROM users WHERE email = $1', [adminEmail])).rows;
        const [targetUser] = (await client.query('SELECT id FROM users WHERE email = $1', [targetEmail])).rows;

        if (adminUser && targetUser) {
            const adminId = adminUser.id;
            const targetId = targetUser.id;
            console.log(`Deep cleanup for ${adminEmail}...`);

            const commonCols = [
                'user_id',
                'created_by_user_id',
                'updated_by_user_id',
                'approved_by_user_id',
                'rejected_by_user_id',
                'fulfilled_by_user_id',
                'refunded_by_user_id',
                'assigned_by_user_id',
                'processed_by_user_id',
                'deleted_by_user_id',
                'performed_by_user_id',
                'created_by',
                'updated_by',
                'deleted_by'
            ];

            const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            const tables = tablesRes.rows.map(r => r.table_name);

            for (const table of tables) {
                if (table === 'users' || table === 'employee_credentials') continue;
                for (const col of commonCols) {
                    try {
                        const res = await client.query(`UPDATE "${table}" SET "${col}" = $1 WHERE "${col}" = $2`, [targetId, adminId]);
                        if (res.rowCount && res.rowCount > 0) console.log(`Reassigned ${res.rowCount} records in ${table}.${col}`);
                    } catch (e: any) {
                        // Ignore missing columns
                    }
                }
            }

            // Finally delete the user
            await client.query('DELETE FROM users WHERE id = $1', [adminId]);
            console.log(`Successfully deleted user ${adminEmail}`);

        } else {
            console.log('Users not found.');
        }

    } catch (err: any) {
        console.error('Final cleanup failed:', err.message);
    } finally {
        await client.end();
    }
}

run();
