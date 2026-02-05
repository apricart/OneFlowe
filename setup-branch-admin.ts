import * as dotenv from 'dotenv';
import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('No DB URL found');

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        console.log('Connected to database');

        const targetEmail = 'memonuzair331@gmail.com';
        const password = '$Urti1122';
        const roleId = 3; // BRANCH_ADMIN
        const orgId = 1;  // Organization S
        const branchId = 1; // Malir Halt Branch

        // 1. Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 2. Update or Create user in 'users' table
        const updateRes = await client.query(
            `UPDATE users 
       SET password_hash = $1, role_id = $2, organization_id = $3, branch_id = $4, updated_at = NOW() 
       WHERE email = $5 RETURNING id`,
            [passwordHash, roleId, orgId, branchId, targetEmail]
        );

        if (updateRes.rows.length > 0) {
            console.log(`Updated user ${targetEmail} (ID: ${updateRes.rows[0].id})`);
        } else {
            console.log(`User ${targetEmail} not found. Creating...`);
            await client.query(
                `INSERT INTO users (email, password_hash, role_id, organization_id, branch_id, full_name) 
         VALUES ($1, $2, $3, $4, $5, 'Uzair Memon')`,
                [targetEmail, passwordHash, roleId, orgId, branchId]
            );
            console.log(`Created user ${targetEmail}`);
        }

        // 3. Remove from employee_credentials to ensure single entity
        const delCredRes = await client.query('DELETE FROM employee_credentials WHERE email = $1', [targetEmail]);
        if (delCredRes.rowCount && delCredRes.rowCount > 0) {
            console.log(`Deleted ${delCredRes.rowCount} record(s) from employee_credentials for ${targetEmail}`);
        }

        console.log('Operation completed successfully.');

    } catch (err) {
        console.error('Operation failed:', err);
    } finally {
        await client.end();
    }
}

run();
