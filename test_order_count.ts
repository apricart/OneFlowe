import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "./lib/db";
import { orders } from "./db/schema";
import { sql } from "drizzle-orm";

async function main() {
    const res = await db.select({
        total: sql<number>`count(*)`,
        fulfilled: sql<number>`count(CASE WHEN status = 'FULFILLED' THEN 1 END)`,
        revenue: sql<number>`sum(CASE WHEN status IN ('FULFILLED', 'REFUNDED') THEN total_cents - COALESCE(refund_amount_cents, 0) ELSE 0 END)`,
        nullUsers: sql<number>`count(CASE WHEN created_by_user_id IS NULL THEN 1 END)`
    }).from(orders);
    
    console.log("ALL ORDERS:", res[0]);

    const byMonth = await db.select({
        month: sql<string>`TO_CHAR(created_at, 'YYYY-MM')`,
        total: sql<number>`count(*)`,
        distinctUsers: sql<number>`count(distinct created_by_user_id)`
    }).from(orders).groupBy(sql`TO_CHAR(created_at, 'YYYY-MM')`);

    console.log("BY MONTH:", byMonth);

    process.exit(0);
}

main().catch(console.error);
