import { db } from './lib/db'
import { sql } from 'drizzle-orm'

async function migrate() {
    console.log('Creating partial unique index on global_products.product_code...')
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS global_products_code_unique_active ON global_products (product_code) WHERE deleted_at IS NULL`)
    console.log('Done!')
    process.exit(0)
}

migrate().catch(e => {
    console.error('Migration failed:', e)
    process.exit(1)
})
