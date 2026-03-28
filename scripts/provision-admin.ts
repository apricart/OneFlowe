import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function run() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error("No database string found in .env.local");

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to Target Database.");

        const targetUsername = 'admin';
        const targetEmail = 'admin@apricart.com'; // Using a placeholder email
        const targetPassword = 'admin123';
        const roleId = 1; // SUPER_ADMIN

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(targetPassword, salt);

        console.log(`Processing Super Admin with username: ${targetUsername}`);

        // 1. Process 'users' table
        // We use 'username' since it has a unique index.
        const userCheck = await client.query("SELECT id FROM users WHERE username = $1", [targetUsername]);
        
        if (userCheck.rows.length > 0) {
            console.log(`User 'admin' found in 'users' table (ID: ${userCheck.rows[0].id}). Updating password and role...`);
            await client.query(
                `UPDATE users 
                 SET password_hash = $1, role_id = $2, is_active = true, updated_at = NOW() 
                 WHERE username = $3`,
                [passwordHash, roleId, targetUsername]
            );
        } else {
            console.log(`User 'admin' NOT found in 'users' table. Inserting...`);
            // Check if email conflicts (though not unique, good practice)
            const emailCheck = await client.query("SELECT id FROM users WHERE email = $1", [targetEmail]);
            if (emailCheck.rows.length > 0) {
                 await client.query(
                    `UPDATE users 
                     SET password_hash = $1, role_id = $2, username = $3, is_active = true, updated_at = NOW() 
                     WHERE email = $4`,
                    [passwordHash, roleId, targetUsername, targetEmail]
                );
                console.log(`Updated existing user by email ${targetEmail} with username 'admin'`);
            } else {
                await client.query(
                    `INSERT INTO users (email, username, password_hash, role_id, is_active, full_name)
                     VALUES ($1, $2, $3, $4, true, 'System Admin')`,
                    [targetEmail, targetUsername, passwordHash, roleId]
                );
                console.log(`Inserted new Super Admin into 'users' table.`);
            }
        }

        // 2. Process 'employee_credentials' table
        const empCheck = await client.query("SELECT id FROM employee_credentials WHERE username = $1", [targetUsername]);
        
        // We need an ID for createdByUserId if we insert. 
        // We'll use the ID from 'users' table.
        const finalUser = await client.query("SELECT id FROM users WHERE username = $1", [targetUsername]);
        const systemUserId = finalUser.rows[0].id;

        if (empCheck.rows.length > 0) {
            console.log(`User 'admin' found in 'employee_credentials'. Updating...`);
            await client.query(
                `UPDATE employee_credentials 
                 SET password_hash = $1, is_active = true, updated_at = NOW() 
                 WHERE username = $2`,
                [passwordHash, targetUsername]
            );
        } else {
            console.log(`User 'admin' NOT found in 'employee_credentials'. Inserting...`);
            // Super admins usually need organization_id 1 and branch_id 1 for some views 
            // but let's see if we can just find some defaults.
            const orgRes = await client.query("SELECT id FROM organizations LIMIT 1");
            const branchRes = await client.query("SELECT id FROM branches LIMIT 1");
            
            const orgId = orgRes.rows.length > 0 ? orgRes.rows[0].id : 1;
            const branchId = branchRes.rows.length > 0 ? branchRes.rows[0].id : 1;

            await client.query(
                `INSERT INTO employee_credentials (email, username, password_hash, is_active, created_by_user_id, organization_id, branch_id)
                 VALUES ($1, $2, $3, true, $4, $5, $6)`,
                [targetEmail, targetUsername, passwordHash, systemUserId, orgId, branchId]
            );
            console.log(`Inserted new Super Admin into 'employee_credentials' table.`);
        }

        console.log(`\nSUCCESS: Super Admin provisioned.`);
        console.log(`Username: ${targetUsername}`);
        console.log(`Password: ${targetPassword}`);

    } catch (err) {
        console.error("FAILED provisioning admin:", err);
    } finally {
        await client.end();
    }
}

run();
