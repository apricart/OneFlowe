import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

async function createAddonTable() {
  console.log("🚀 Starting manual schema update...");
  
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ No DATABASE_URL or DIRECT_URL found");
    process.exit(1);
  }

  console.log(`🔌 Connecting to: ${connectionString.split('@')[1]}`);

  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const db = drizzle(pool);

  try {
    // 1. Create budget_addons table
    console.log("🛠️ Creating budget_addons table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "budget_addons" (
        "id" serial PRIMARY KEY NOT NULL,
        "budget_id" integer NOT NULL,
        "amount_cents" bigint NOT NULL,
        "reason" text,
        "created_by_user_id" uuid,
        "created_at" timestamp with time zone DEFAULT now()
      );
    `);

    // 2. Add foreign keys and indexes
    console.log("🛠️ Adding constraints and indexes...");
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_addons_budget_id_budgets_id_fk') THEN
          ALTER TABLE "budget_addons" ADD CONSTRAINT "budget_addons_budget_id_budgets_id_fk" 
          FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Constraint might already exist or parent table missing';
      END $$;
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "budget_addons_budget_idx" ON "budget_addons" USING btree ("budget_id");
    `);

    // 3. Update budgets table columns to bigint if they aren't already
    console.log("🛠️ Updating budgets table columns to bigint...");
    try {
      await db.execute(sql`
        ALTER TABLE "budgets" ALTER COLUMN "amount_allocated_cents" SET DATA TYPE bigint;
        ALTER TABLE "budgets" ALTER COLUMN "amount_spent_cents" SET DATA TYPE bigint;
        ALTER TABLE "budgets" ALTER COLUMN "amount_held_cents" SET DATA TYPE bigint;
        ALTER TABLE "budgets" ALTER COLUMN "amount_credited_cents" SET DATA TYPE bigint;
      `);
    } catch (e) {
      console.warn("⚠️ Could not update budget columns. They might already be bigint or the table is empty.");
    }

    console.log("✅ Manual schema update successful!");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during manual schema update:", error);
    await pool.end();
    process.exit(1);
  }
}

createAddonTable();
