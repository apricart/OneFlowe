import { db } from './lib/db';
import { orders } from './db/schema';
import { eq } from 'drizzle-orm';

async function fix() {
  try {
    await db.update(orders)
      .set({ 
        approvalToken: 'M2EFAMFS63', 
        approvalTokenHash: '$2b$10$test' 
      })
      .where(eq(orders.id, 155));
    console.log("Order 155 fixed successfully with Token: M2EFAMFS63");
  } catch (e) {
    console.error("Error fixing order 155:", e);
  }
  process.exit(0);
}

fix();
