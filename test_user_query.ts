import * as dotenv from 'dotenv';
import { db } from './lib/db';
import { users, orders, branches } from './db/schema';
import { and, eq, gte, lte, inArray, sql, desc } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function run() {
    const startDate = new Date("2000-01-01T00:00:00.000Z");
    const endDate = new Date("2026-03-31T23:59:59.999Z");

    // Replicate branch resolution for Super Admin (no org)
    const b = await db.select({ id: branches.id }).from(branches);
    const branchIds = b.map(br => br.id);
    console.log('Resolved Branch IDs:', branchIds);

    if (branchIds.length === 0) {
        console.log("No branches found!");
        return;
    }

    const q = db
        .select({
            userId: users.id,
            userName: users.fullName,
            userEmail: users.email,
            employeeId: users.employeeId,
            branchName: branches.name,
            totalOrders: sql<number>`count(${orders.id})`,
            fulfilledOrders: sql<number>`count(CASE WHEN ${orders.status} IN ('FULFILLED', 'APPROVED') THEN 1 END)`,
            refundedOrders: sql<number>`count(CASE WHEN ${orders.status} = 'REFUNDED' THEN 1 END)`,
            totalSpentCents: sql<number>`sum(CASE WHEN ${orders.status} IN ('FULFILLED', 'APPROVED') THEN ${orders.totalCents} ELSE 0 END)`,
        })
        .from(users)
        .innerJoin(orders, eq(orders.createdByUserId, users.id))
        .leftJoin(branches, eq(users.branchId, branches.id))
        .where(
            and(
                inArray(orders.branchId, branchIds),
                gte(orders.createdAt, startDate),
                lte(orders.createdAt, endDate)
            )
        )
        .groupBy(users.id, branches.name)
        .orderBy(desc(sql`sum(CASE WHEN ${orders.status} IN ('FULFILLED', 'APPROVED') THEN ${orders.totalCents} ELSE 0 END)`))

    const results = await q;
    console.log('Query Results (count):', results.length);
    console.log('Query Results (sample):', results.slice(0, 5));
}

run().catch(console.error).finally(() => process.exit());
