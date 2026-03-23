const { db } = require('./lib/db');
const { orders } = require('./db/schema');
const { eq } = require('drizzle-orm');

async function fix() {
  try {
    await db.update(orders)
      .set({ 
        approvalToken: 'M2EFAMFS63', 
        approvalTokenHash: '$2b$10$test' 
      })
      .where(eq(orders.id, 155));
    console.log("Order 155 fixed");
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

fix();
