import { db } from "./lib/db";
import { orders } from "./db/schema";
import { eq, or, sql, and } from "drizzle-orm";
import fs from "fs";

async function verify() {
  console.log("Verifying REJECTED status logic...");
  
  const conditions = [];
  const upperStatus = "REJECTED";
  
  if (upperStatus === "REJECTED") {
      conditions.push(or(eq(sql`UPPER(${orders.status})`, "REJECTED"), eq(sql`UPPER(${orders.status})`, "CANCELLED")));
  }
  
  const results = await db.select({
      id: orders.id,
      tid: orders.tid,
      status: orders.status
  }).from(orders).where(and(...conditions));
  
  console.log(`Found ${results.length} orders for REJECTED filter.`);
  
  fs.writeFileSync("api_logic_test.json", JSON.stringify(results, null, 2));
  process.exit(0);
}

verify();
