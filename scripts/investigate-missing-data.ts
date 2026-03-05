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

        // 1. Check system_logs for early 2025 activity related to orders
        const systemLogsRes = await client.query(`
      SELECT action, resource_type, COUNT(*) 
      FROM system_logs 
      WHERE timestamp >= '2025-01-01' AND timestamp < '2025-11-01'
      GROUP BY 1, 2
    `);

        // 2. Check audit_logs for early 2025 activity related to orders
        const auditLogsRes = await client.query(`
      SELECT action, entity, COUNT(*) 
      FROM audit_logs 
      WHERE created_at >= '2025-01-01' AND created_at < '2025-11-01'
      GROUP BY 1, 2
    `);

        // 3. Search all tables for any '2025' data
        const allTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

        const tableCounts = [];
        for (const row of allTables.rows) {
            const tableName = row.table_name;
            // Skip potentially huge logs tables if needed, but let's be thorough
            try {
                const countRes = await client.query(`
          SELECT COUNT(*) as count 
          FROM "${tableName}" 
          WHERE 
            (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'created_at') THEN (created_at >= '2025-01-01' AND created_at < '2025-11-01') ELSE FALSE END)
            OR
            (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'timestamp') THEN (timestamp >= '2025-01-01' AND timestamp < '2025-11-01') ELSE FALSE END)
        `);
                if (parseInt(countRes.rows[0].count) > 0) {
                    tableCounts.push({ table: tableName, count: countRes.rows[0].count });
                }
            } catch (err) {
                // Some tables might not have standard date columns
            }
        }

        const output = {
            system_logs_2025_early: systemLogsRes.rows,
            audit_logs_2025_early: auditLogsRes.rows,
            tables_with_2025_early_data: tableCounts,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync("scripts/missing-data-investigation.json", JSON.stringify(output, null, 2));
        console.log("Deep scan results written to scripts/missing-data-investigation.json");

    } catch (err) {
        console.error("error", err);
    } finally {
        await client.end();
    }
}

main();
