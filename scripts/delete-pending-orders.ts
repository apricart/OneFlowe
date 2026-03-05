import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "../lib/db"
import { orders, orderItems, budgets, globalProducts, systemLogs, refunds, refundItems } from "../db/schema"
import { eq, or, inArray, sql, and } from "drizzle-orm"

async function main() {
    console.log("Fetching pending and approved orders...")

    const targetOrders = await db.select().from(orders).where(
        or(
            eq(sql`UPPER(${orders.status})`, 'PENDING'),
            eq(sql`UPPER(${orders.status})`, 'APPROVED')
        )
    )

    console.log(`Found ${targetOrders.length} orders to delete.`)

    if (targetOrders.length === 0) {
        console.log("No orders to delete.")
        return
    }

    for (const ord of targetOrders) {
        console.log(`Processing Order ID: ${ord.id} - Status: ${ord.status}`)

        await db.transaction(async (tx) => {
            // 1. Restore Stock
            const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, ord.id))
            for (const item of items) {
                await tx.update(globalProducts)
                    .set({
                        stockQuantity: sql`${globalProducts.stockQuantity} + ${item.quantity}`,
                        updatedAt: new Date()
                    })
                    .where(eq(globalProducts.id, item.globalProductId))
            }

            // 2. Restore Budget
            const createdAt = ord.createdAt || new Date()
            const currentMonth = new Date(createdAt).toISOString().slice(0, 7)
            const branchBudgets = await tx.select().from(budgets).where(
                and(
                    eq(budgets.branchId, ord.branchId),
                    eq(budgets.period, currentMonth)
                )
            ).limit(1)

            if (branchBudgets.length > 0) {
                const budget = branchBudgets[0]
                await tx.update(budgets)
                    .set({ amountHeldCents: sql`${budgets.amountHeldCents} - ${ord.totalCents}` })
                    .where(eq(budgets.id, budget.id))
            }

            // 3. Delete dependent records
            await tx.delete(systemLogs).where(
                and(
                    eq(systemLogs.resourceType, 'order'),
                    eq(systemLogs.resourceId, String(ord.id))
                )
            )

            const orderRefunds = await tx.select().from(refunds).where(eq(refunds.orderId, ord.id))
            const refundIds = orderRefunds.map(r => r.id)

            if (refundIds.length > 0) {
                await tx.delete(refundItems).where(inArray(refundItems.refundId, refundIds))
                await tx.delete(refunds).where(eq(refunds.orderId, ord.id))
            }

            // 4. Delete order items
            await tx.delete(orderItems).where(eq(orderItems.orderId, ord.id))

            // 5. Delete order
            await tx.delete(orders).where(eq(orders.id, ord.id))
        })

        console.log(`Deleted order ${ord.id}`)
    }

    console.log("Cleanup complete.")
}

main().catch(console.error)
