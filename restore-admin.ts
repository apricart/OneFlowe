import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        const adminEmail = 'admin@example.com';
        const adminPassword = 'admin123';
        // Hash password with 10 rounds as per bcryptjs standard
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);
        const superAdminRoleId = 1;

        // 1. Identify test accounts to remove based on user's request
        // The user wants to remove ALL other emails with admin-related names.
        const conflictRes = await client.query(
            "SELECT id, email FROM users WHERE email LIKE '%admin%' AND email != $1",
            [adminEmail]
        );

        for (const row of conflictRes.rows) {
            const email = row.email;
            const userId = row.id;
            console.log(`Cleaning up test account: ${email}`);

            // Remove linked data - using correct column names from schema
            // employee_credentials uses 'email', audit_logs uses 'user_id'
            await client.query('DELETE FROM employee_credentials WHERE email = $1', [email]);
            await client.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);

            await client.query('DELETE FROM users WHERE id = $1', [userId]);
            console.log(`Successfully removed ${email}`);
        }

        // 2. Re-add/Update the primary admin account
        console.log(`Restoring primary Super Admin: ${adminEmail}`);

        // Check if it exists
        const existingRes = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

        if (existingRes.rows.length > 0) {
            console.log("Account already exists, updating...");
            await client.query(
                'UPDATE users SET password_hash = $1, role_id = $2, first_name = $3, last_name = $4, is_active = $5 WHERE email = $6',
                [hashedPassword, superAdminRoleId, 'System', 'Administrator', true, adminEmail]
            );
        } else {
            console.log("Creating new account...");
            await client.query(
                'INSERT INTO users (email, password_hash, first_name, last_name, role_id, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
                [adminEmail, hashedPassword, 'System', 'Administrator', superAdminRoleId, true]
            );
        }

        // Ensure it's also cleared from employee_credentials if it exists there
        await client.query('DELETE FROM employee_credentials WHERE email = $1', [adminEmail]);

        console.log(`\nSUCCESS: ${adminEmail} restored as Super Admin.`);
        console.log(`Password: ${adminPassword}`);

    } catch (err) {
        console.error("ERROR during restoration:", err);
    } finally {
        await client.end();
    }
}

run();
