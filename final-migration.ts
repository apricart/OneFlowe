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
            console.log(`Migrating data from ${adminId} to ${targetId}`);

            // Reassign references in branch_inventory
            await client.query('UPDATE branch_inventory SET assigned_by_user_id = $1 WHERE assigned_by_user_id = $2', [targetId, adminId]);
            console.log('Reassigned branch_inventory');

            // Check for other potential references based on common patterns
            const reassignTables = [
                ['orders', 'created_by'],
                ['orders', 'approved_by'],
                ['restock_requests', 'created_by'],
                ['refunds', 'processed_by'],
                ['master_products', 'created_by']
            ];

            for (const [table, column] of reassignTables) {
                try {
                    await client.query(`UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`, [targetId, adminId]);
                    console.log(`Reassigned ${table}.${column}`);
                } catch (e) { }
            }

            // Finally delete the user
            await client.query('DELETE FROM users WHERE id = $1', [adminId]);
            console.log(`Successfully deleted user ${adminEmail}`);
        } else {
            console.log('Users not found for migration.');
        }

    } catch (err) {
        console.error('Migration/Cleanup failed:', err);
    } finally {
        await client.end();
    }
}

run();
