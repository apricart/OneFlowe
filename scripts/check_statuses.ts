import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../lib/db';
import { orders } from '../db/schema';
import { sql } from 'drizzle-orm';

async function check() {
  try {
    const stats = await db.select({ 
      status: orders.status, 
      count: sql<number>`count(*)` 
    }).from(orders).groupBy(orders.status);
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

check();
