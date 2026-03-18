import { db } from "./lib/db";
import { users, orders } from "./db/schema";
import { count, eq } from "drizzle-orm";

async function check() {
  const usersCount = await db.select({ value: count() }).from(users);
  console.log("Total Users:", usersCount[0].value);

  const ordersCount = await db.select({ value: count() }).from(orders);
  console.log("Total Orders:", ordersCount[0].value);

  const ordersWithUser = await db.select({ value: count() })
    .from(orders)
    .where(sql`created_by_user_id IS NOT NULL`);
  console.log("Orders with created_by_user_id:", ordersWithUser[0].value);

  const joined = await db.select({ userId: users.id })
    .from(users)
    .innerJoin(orders, eq(orders.createdByUserId, users.id))
    .limit(5);
  console.log("Joined sample (first 5 users with orders):", joined);
}

// Need to handle the sql import if using it
import { sql } from "drizzle-orm";

check().catch(console.error).finally(() => process.exit());
