import { db } from './lib/db'
import { orders, orderItems, budgets, systemLogs, globalProducts } from './db/schema'
import { eq, and, sql } from 'drizzle-orm'

async function deleteOrder() {
    try {
        console.log('Fetching order 94 details...')

        // Get order details first
        const [order] = await db.select().from(orders).where(eq(orders.id, 94))

        if (!order) {
            console.log('❌ Order 94 not found')
            process.exit(1)
        }

        console.log('Order details:', {
            id: order.id,
            tid: order.tid,
            status: order.status,
            total: `Rs ${(order.totalCents / 100).toFixed(2)}`,
            branchId: order.branchId,
            createdAt: order.createdAt
        })

        console.log('\n⚠️  WARNING: This will DELETE order 94 and all related data!')
        console.log('Proceeding in 2 seconds...\n')

        await new Promise(resolve => setTimeout(resolve, 2000))

        // Start transaction
        await db.transaction(async (tx) => {
            console.log('1. Checking for related data...')

            // Get order items
            const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, 94))
            console.log(`   Found ${items.length} order items`)

            // Get current month budget
            const currentMonth = new Date().toISOString().slice(0, 7)
            const [budget] = await tx.select().from(budgets).where(
                and(
                    eq(budgets.branchId, order.branchId),
                    eq(budgets.period, currentMonth)
                )
            )

            if (budget) {
                console.log(`   Found budget for branch ${order.branchId}`)
            }

            console.log('\n2. Deleting order items...')
            await tx.delete(orderItems).where(eq(orderItems.orderId, 94))
            console.log('   ✅ Order items deleted')

            console.log('\n3. Restoring stock to global products...')
            for (const item of items) {
                await tx.update(globalProducts)
                    .set({
                        stockQuantity: sql`${globalProducts.stockQuantity} + ${item.quantity}`,
                        updatedAt: new Date()
                    })
                    .where(eq(globalProducts.id, item.globalProductId))
                console.log(`   ✅ Restored ${item.quantity} units of ${item.productName}`)
            }

            console.log('\n4. Releasing budget hold...')
            if (budget) {
                const orderStatus = order.status.toLowerCase()
                if (orderStatus === 'approved' || orderStatus === 'pending') {
                    // Release from held
                    await tx.update(budgets)
                        .set({
                            amountHeldCents: sql`${budgets.amountHeldCents} - ${order.totalCents}`
                        })
                        .where(eq(budgets.id, budget.id))
                    console.log(`   ✅ Released Rs ${(order.totalCents / 100).toFixed(2)} from budget hold`)
                } else if (orderStatus === 'fulfilled') {
                    // Remove from spent
                    await tx.update(budgets)
                        .set({
                            amountSpentCents: sql`${budgets.amountSpentCents} - ${order.totalCents}`
                        })
                        .where(eq(budgets.id, budget.id))
                    console.log(`   ✅ Removed Rs ${(order.totalCents / 100).toFixed(2)} from budget spent`)
                }
            }

            console.log('\n5. Deleting system logs...')
            await tx.delete(systemLogs).where(
                and(
                    eq(systemLogs.resourceType, 'order'),
                    eq(systemLogs.resourceId, '94')
                )
            )
            console.log('   ✅ System logs deleted')

            console.log('\n6. Deleting the order...')
            await tx.delete(orders).where(eq(orders.id, 94))
            console.log('   ✅ Order deleted')

            console.log('\n✅ SUCCESS! Order 94 has been completely deleted.')
            console.log('📊 Today\'s GMV should now only show Rs 5,000 from order 96')
        })

    } catch (error: any) {
        console.error('\n❌ Error:', error.message)
        console.error(error)
        process.exit(1)
    } finally {
        process.exit(0)
    }
}

deleteOrder()
