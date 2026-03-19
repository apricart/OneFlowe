import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, users } from "@/db/schema";
import { eq, sql, gte, lte, and } from "drizzle-orm";

export async function GET() {
    try {
        let startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        let endDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)

        const dateFiltered = await db.select({ c: sql<number>`count(*)` })
            .from(orders)
            .where(
                and(
                    gte(orders.createdAt, startDate),
                    lte(orders.createdAt, endDate)
                )
            );

        // check orders per user
        const byUserFiltered = await db.select({
            userId: orders.createdByUserId,
            count: sql<number>`count(*)`
        })
        .from(orders)
        .where(
            and(
                gte(orders.createdAt, startDate),
                lte(orders.createdAt, endDate)
            )
        )
        .groupBy(orders.createdByUserId);

        return NextResponse.json({
            dateFiltered: dateFiltered[0].c,
            startDate, endDate,
            byUserFiltered
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
