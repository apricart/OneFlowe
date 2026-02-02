
import { config } from "dotenv"
config({ path: ".env.local" })
import { db } from "../lib/db"
import { orders } from "../db/schema"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Checking all order statuses in database...")

    const statusCounts = await db
        .select({
            status: orders.status,
            count: sql<number>`count(*)::int`
        })
        .from(orders)
        .groupBy(orders.status)
        .orderBy(orders.status)

    console.log("\nCurrent Order Statuses:")
    console.table(statusCounts)

    process.exit(0)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
