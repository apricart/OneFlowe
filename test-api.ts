import { config } from "dotenv"
config({ path: ".env.local" })

import { db } from "./lib/db.js"
import { orders } from "./db/schema.js"
import { sql, and, gte, lte } from "drizzle-orm"

async function run() {
    console.log("Fetching lifetime stats...")
    const [lifetime] = await db
        .select({
            totalRevenue: sql`COALESCE(SUM(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)::bigint`,
            totalOrders: sql`COUNT(*)::int`,
        })
        .from(orders)
        .where(sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED')`)

    console.log("Lifetime:", lifetime)

    console.log("Fetching all-time sales performance...")
    const startDate = new Date("2000-01-01T00:00:00.000Z")
    const endDate = new Date()

    const [perf] = await db
        .select({
            totalRevenue: sql`coalesce(sum(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)`,
            totalOrders: sql`coalesce(count(${orders.id}), 0)`,
        })
        .from(orders)
        .where(and(
            gte(orders.createdAt, startDate),
            lte(orders.createdAt, endDate),
            sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED', 'PENDING')`
        ))

    console.log("Perf All-Time:", perf)

    const [perfToday] = await db
        .select({
            totalRevenue: sql`coalesce(sum(${orders.totalCents} - COALESCE(${orders.refundAmountCents}, 0)), 0)`,
            totalOrders: sql`coalesce(count(${orders.id}), 0)`,
        })
        .from(orders)
        .where(and(
            gte(orders.createdAt, new Date(new Date().setHours(0, 0, 0, 0))),
            lte(orders.createdAt, new Date()),
            sql`UPPER(${orders.status}) IN ('APPROVED', 'FULFILLED', 'REFUNDED', 'PENDING')`
        ))

    console.log("Perf Today:", perfToday)

    process.exit(0)
}

run().catch(console.error)
