import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "@/lib/db";
import { orders } from "@/db/schema";
import { gte, lte, and, sql } from "drizzle-orm";

async function main() {
    const start = new Date("2025-01-01T00:00:00Z");
    const end = new Date("2025-12-31T23:59:59Z");

    const results = await db
        .select({
            month: sql`TO_CHAR(${orders.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi', 'YYYY-MM')`,
            count: sql`COUNT(${orders.id})`,
        })
        .from(orders)
        .where(and(gte(orders.createdAt, start), lte(orders.createdAt, end)))
        .groupBy(sql`TO_CHAR(${orders.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi', 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${orders.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi', 'YYYY-MM')`);

    console.log("2025 Orders Breakdown:");
    console.log(JSON.stringify(results, null, 2));

    const older = await db
        .select({ count: sql`COUNT(${orders.id})` })
        .from(orders)
        .where(lte(orders.createdAt, start));
    console.log("Orders older than 2025:", older[0].count);

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
