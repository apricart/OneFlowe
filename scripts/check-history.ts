import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Client } from "pg";
import * as fs from "fs";

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to DB");

        const res = await client.query(`
      SELECT 
        TO_CHAR(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi', 'YYYY-MM') as month,
        COUNT(*) as count
      FROM orders
      GROUP BY 1
      ORDER BY 1;
    `);

        const total = await client.query("SELECT COUNT(*) FROM orders");

        const output = {
            history: res.rows,
            total: total.rows[0].count,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync("scripts/db-check-result.json", JSON.stringify(output, null, 2));
        console.log("Results written to scripts/db-check-result.json");

    } catch (err) {
        console.error("error", err);
    } finally {
        await client.end();
    }
}

main();
