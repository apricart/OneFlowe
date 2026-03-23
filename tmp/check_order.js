const { db } = require('./lib/db');
const { orders } = require('./db/schema');
const { eq } = require('drizzle-orm');

async function check() {
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, 155));
    console.log(JSON.stringify(o, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

check();
