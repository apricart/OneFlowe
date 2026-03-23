import { db } from "../lib/db";
import { budgets, budgetAddons } from "../db/schema";
import { sql } from "drizzle-orm";

async function wipeAll() {
  try {
    console.log("--- PROCEEDING WITH TOTAL BUDGET DATA WIPE ---");
    
    // 1. Delete all budget addons first (foreign key dependency)
    const addonsRes = await db.delete(budgetAddons);
    console.log("Deleted all budget addons.");

    // 2. Delete all budget records
    const budgetRes = await db.delete(budgets);
    console.log("Deleted all budget records.");

    console.log("--- WIPE COMPLETE ---");
  } catch (error) {
    console.error("Wipe Error:", error);
  } finally {
    process.exit(0);
  }
}

wipeAll();
