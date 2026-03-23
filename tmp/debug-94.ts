import { db } from "../lib/db";
import { budgets } from "../db/schema";
import { eq } from "drizzle-orm";

async function debug94() {
  try {
    const res = await db.select().from(budgets).where(eq(budgets.id, 94));
    console.log("Record 94:", JSON.stringify(res, null, 2));
  } catch (error) {
    console.error("Debug Error:", error);
  } finally {
    process.exit(0);
  }
}

debug94();
