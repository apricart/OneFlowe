import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Client } from "pg";

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
      WHERE created_at >= '2025-01-01' AND created_at <= '2025-12-31'
      GROUP BY 1
      ORDER BY 1;
    `);

        console.log("2025 Orders Breakdown:");
        console.log(JSON.stringify(res.rows, null, 2));

        const older = await client.query("SELECT COUNT(*) FROM orders WHERE created_at < '2025-01-01'");
        console.log("Orders older than 2025:", older.rows[0].count);

        const earliest = await client.query("SELECT MIN(created_at) FROM orders");
        console.log("Earliest order date:", earliest.rows[0].min);

    } catch (err) {
        console.error("error connecting or querying", err);
    } finally {
        await client.end();
    }
}

main();
