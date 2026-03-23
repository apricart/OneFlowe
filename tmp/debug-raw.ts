import { db } from "../lib/db";
import { budgets } from "../db/schema";
import { eq } from "drizzle-orm";

async function debugRaw() {
  try {
    const res = await db.select().from(budgets).where(eq(budgets.id, 94));
    if (res.length > 0) {
      const period = res[0].period;
      console.log("Raw Period Value:", JSON.stringify(period));
      console.log("Period Length:", period.length);
      console.log("Exact Comparison '2026-03':", period === "2026-03");
    } else {
      console.log("Record ID 94 not found!");
    }
  } catch (error) {
    console.error("Debug Error:", error);
  } finally {
    process.exit(0);
  }
}

debugRaw();
