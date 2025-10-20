import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { Client } from "pg"

async function syncSchema() {
  try {
    console.log("🔄 Syncing schema with database...")

    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    })

    await client.connect()

    // Add missing columns to budgets table
    console.log("📝 Updating budgets table...")
    await client.query(`
      ALTER TABLE "budgets"
      ADD COLUMN IF NOT EXISTS "organization_id" integer,
      ADD COLUMN IF NOT EXISTS "amount_held_cents" integer DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS "amount_credited_cents" integer DEFAULT 0 NOT NULL
    `).catch((e) => console.log("ℹ️ Budgets columns:", e.message))

    // Add FK for organization_id
    await client.query(`
      ALTER TABLE "budgets"
      ADD CONSTRAINT "budgets_organization_id_organizations_id_fk" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    `).catch((e) => console.log("ℹ️ Budgets org FK:", e.message))

    // Create indexes for budgets
    await client.query(`
      CREATE INDEX IF NOT EXISTS "budgets_org_idx" ON "budgets" USING btree ("organization_id")
    `).catch((e) => console.log("ℹ️ Budgets org index:", e.message))

    await client.query(`
      CREATE INDEX IF NOT EXISTS "budgets_branch_idx" ON "budgets" USING btree ("branch_id")
    `).catch((e) => console.log("ℹ️ Budgets branch index:", e.message))

    // Add missing columns to orders table
    console.log("📝 Updating orders table...")
    await client.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "tid" varchar(26) NOT NULL DEFAULT gen_random_uuid()::text,
      ADD COLUMN IF NOT EXISTS "subtotal_cents" integer DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS "tax_cents" integer DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS "notes" text
    `).catch((e) => console.log("ℹ️ Orders columns:", e.message))

    // Add unique constraint on tid if not exists
    await client.query(`
      ALTER TABLE "orders"
      ADD CONSTRAINT "orders_tid_unique" UNIQUE("tid")
    `).catch((e) => console.log("ℹ️ Orders tid unique constraint:", e.message))

    // Update orderItems table
    console.log("📝 Updating order_items table...")
    
    // Add new columns
    await client.query(`
      ALTER TABLE "order_items"
      ADD COLUMN IF NOT EXISTS "global_product_id" integer,
      ADD COLUMN IF NOT EXISTS "product_name" varchar(255),
      ADD COLUMN IF NOT EXISTS "product_code" varchar(128),
      ADD COLUMN IF NOT EXISTS "unit" varchar(64),
      ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now()
    `).catch((e) => console.log("ℹ️ Order items columns:", e.message))

    // Drop old sku_id constraint if exists
    await client.query(`
      ALTER TABLE "order_items"
      DROP CONSTRAINT IF EXISTS "order_items_sku_id_skus_id_fk"
    `).catch((e) => console.log("ℹ️ Old FK:", e.message))

    // Add foreign key for global_product_id
    await client.query(`
      ALTER TABLE "order_items"
      ADD CONSTRAINT "order_items_global_product_id_global_products_id_fk" 
      FOREIGN KEY ("global_product_id") REFERENCES "global_products"("id")
    `).catch((e) => console.log("ℹ️ New FK:", e.message))

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS "orders_tid_idx" ON "orders" USING btree ("tid")
    `).catch((e) => console.log("ℹ️ Orders TID index:", e.message))

    await client.query(`
      CREATE INDEX IF NOT EXISTS "order_items_product_idx" ON "order_items" USING btree ("global_product_id")
    `).catch((e) => console.log("ℹ️ Order items product index:", e.message))

    await client.end()

    console.log("✅ Schema synced successfully!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error syncing schema:", error)
    process.exit(1)
  }
}

syncSchema()
