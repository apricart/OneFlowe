import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    const tids = ['mlfadf9s5psgv6wf', 'mlugyt3hgnlqrxqn', 'mluhmw2ld84gsdgd', 'mlqdn2o0pte0ehl6'];
    for (const tid of tids) {
        console.log(`\n--- Investigating TID: ${tid} ---`);
        const orderRes = await client.query('SELECT id, total_cents, refund_amount_cents, status FROM orders WHERE tid = $1', [tid]);
        if (orderRes.rows.length === 0) {
            console.log('Order not found');
            continue;
        }
        const order = orderRes.rows[0];
        const orderId = order.id;
        const itemsRes = await client.query(`
            SELECT 
                oi.id, 
                oi.price_cents, 
                oi.quantity, 
                COALESCE(SUM(ri.quantity), 0) as total_refund_qty,
                COALESCE(SUM(ri.amount_cents), 0) as total_refund_amount
            FROM order_items oi 
            LEFT JOIN refund_items ri ON oi.id = ri.order_item_id 
            WHERE oi.order_id = $1
            GROUP BY oi.id, oi.price_cents, oi.quantity
        `, [orderId]);
        
        console.log('Order Status:', order.status);
        console.log('Order Total (cents):', order.total_cents);
        console.log('Order Refund Amount (cents):', order.refund_amount_cents);
        
        let calculatedItemRevenue = 0;
        let calculatedRefundSum = 0;
        
        console.log('Items:');
        for (const item of itemsRes.rows) {
            const itemRev = item.price_cents * (item.quantity - item.total_refund_qty);
            calculatedItemRevenue += itemRev;
            calculatedRefundSum += Number(item.total_refund_amount);
            console.log(` - Item ID ${item.id}: Price ${item.price_cents}, Qty ${item.quantity}, RefundQty ${item.total_refund_qty}, RefundAmt ${item.total_refund_amount}`);
        }
        
        console.log('Calculated Item Revenue (cents):', calculatedItemRevenue);
        console.log('Calculated Refund Sum from items (cents):', calculatedRefundSum);
        console.log('Difference (Order Refund vs Item Refund):', order.refund_amount_cents - calculatedRefundSum);
    }
  } finally {
    await client.end();
  }
}

check();
