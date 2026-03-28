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
        const targetEmail = 'admin@example.com';
        const targetPassword = 'admin123';
        const roleId = 1; // Usually Super Admin

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(targetPassword, salt);

        // Check columns in users table
        const colsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        const userCols = colsRes.rows.map(r => r.column_name);
        
        let insertUserQuery = '';
        let insertUserValues: any[] = [];
        
        const hasFullName = userCols.includes('full_name');
        const hasFirstName = userCols.includes('first_name');
        
        if (hasFullName) {
            insertUserQuery = `
                INSERT INTO users (email, password_hash, role_id, full_name, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (email) DO UPDATE 
                SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id,
                    full_name = EXCLUDED.full_name, is_active = true
                RETURNING id;
            `;
            insertUserValues = [targetEmail, passwordHash, roleId, 'Super Admin'];
        } else if (hasFirstName) {
            insertUserQuery = `
                INSERT INTO users (email, password_hash, role_id, first_name, last_name, is_active)
                VALUES ($1, $2, $3, $4, $5, true)
                ON CONFLICT (email) DO UPDATE 
                SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id,
                    first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, is_active = true
                RETURNING id;
            `;
            insertUserValues = [targetEmail, passwordHash, roleId, 'Super', 'Admin'];
        } else {
             insertUserQuery = `
                INSERT INTO users (email, password_hash, role_id, is_active)
                VALUES ($1, $2, $3, true)
                ON CONFLICT (email) DO UPDATE 
                SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, is_active = true
                RETURNING id;
            `;
            insertUserValues = [targetEmail, passwordHash, roleId];
        }

        const userRes = await client.query(insertUserQuery, insertUserValues);
        console.log(`Successfully created/updated user in users table with ID: ${userRes.rows[0].id}`);

        // Also check employee_credentials since column 'username' was added
        const empColsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'employee_credentials'");
        const empCols = empColsRes.rows.map(r => r.column_name);
        
        if (empCols.includes('username')) {
            console.log("employee_credentials has 'username' column. Updating/Inserting...");
            
            // Try to find if user exists by username or email
            const search = await client.query("SELECT id FROM employee_credentials WHERE username = $1 OR email = $2", [targetUsername, targetEmail]);
            
            if (search.rows.length > 0) {
                await client.query(
                    "UPDATE employee_credentials SET password_hash = $1, username = $2 WHERE id = $3",
                    [passwordHash, targetUsername, search.rows[0].id]
                );
                console.log(`Updated existing employee_credentials for ${targetUsername}`);
            } else {
                if (empCols.includes('branch_id')) {
                     await client.query(
                        "INSERT INTO employee_credentials (email, username, password_hash, role_id, is_active, permissions) VALUES ($1, $2, $3, $4, true, '[]')",
                        [targetEmail, targetUsername, passwordHash, roleId]
                    );
                } else {
                     await client.query(
                        "INSERT INTO employee_credentials (email, username, password_hash, role_id, is_active) VALUES ($1, $2, $3, $4, true)",
                        [targetEmail, targetUsername, passwordHash, roleId]
                    );
                }
                console.log(`Inserted new employee_credentials for ${targetUsername}`);
            }
        }

        console.log(`\nDONE! Admin user has been added/updated.`);
        console.log(`Login identifier: 'admin' (or 'admin@example.com')`);
        console.log(`Password: 'admin123'`);

    } catch (err) {
        console.error("FAILED querying DB:", err);
    } finally {
        await client.end();
    }
}

run();
