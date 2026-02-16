const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function diagnose() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    console.log("Checking database entities...");

    try {
        const userId = "f81b18b1-0aa7-4614-9206-fe4afa81f061";
        const orgId = 1;
        const groupName = "dev";

        // Check Organization
        const orgRes = await pool.query("SELECT id, name FROM organizations WHERE id = $1", [orgId]);
        console.log("Organization check:", orgRes.rows.length > 0 ? `Found: ${orgRes.rows[0].name}` : "NOT FOUND");

        // Check User
        const userRes = await pool.query("SELECT id, email FROM users WHERE id = $1", [userId]);
        console.log("User check:", userRes.rows.length > 0 ? `Found: ${userRes.rows[0].email}` : "NOT FOUND");

        // Check Existing Groups
        const groupRes = await pool.query("SELECT id, name FROM groups WHERE organization_id = $1 AND name = $2", [orgId, groupName]);
        console.log("Conflicting group check:", groupRes.rows.length > 0 ? `CONFLICT FOUND: ID ${groupRes.rows[0].id}` : "No conflicts found");

    } catch (e: any) {
        console.error("Diagnosis failed:", e.message);
    } finally {
        await pool.end();
    }
}

diagnose();

export { }
