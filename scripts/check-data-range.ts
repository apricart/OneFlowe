/**
 * Check actual order data range in database
 * Run: npx tsx scripts/check-data-range.ts
 */
import { Pool } from "pg"

const DB_CONFIG = {
  host: "aws-1-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.csxwfjwytobgzrtt",
  password: "fv9g!Kp8?,/$tDk",
  ssl: { rejectUnauthorized: false },
}

async function checkDataRange() {
  console.log("🔍 Checking Actual Order Data\n")
  
  const pool = new Pool(DB_CONFIG)
  const client = await pool.connect()
  
  try {
    await client.query(`SET SESSION row_security = off`)
    
    // Get actual date range of orders
    const rangeResult = await client.query(`
      SELECT 
        MIN(created_at) as earliest_order,
        MAX(created_at) as latest_order,
        COUNT(*) as total_orders
      FROM orders
    `)
    
    console.log("📅 Order Date Range:")
    console.table(rangeResult.rows)
    
    // Get orders by year
    const yearResult = await client.query(`
      SELECT 
        EXTRACT(YEAR FROM created_at) as year,
        COUNT(*) as order_count,
        SUM(total_cents) / 100 as revenue
      FROM orders
      GROUP BY 1
      ORDER BY 1
    `)
    
    console.log("\n📊 Orders by Year:")
    console.table(yearResult.rows)
    
    // Check what years are actually in the data
    const years = yearResult.rows.map(r => r.year)
    console.log("\n✅ Actual years in database:", years)
    console.log("\n💡 The API should use:")
    console.log(`   - Start: ${rangeResult.rows[0].earliest_order || '2026-01-01'}`)
    console.log(`   - End: ${rangeResult.rows[0].latest_order || '2026-12-31'}`)
    
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkDataRange().catch(() => process.exit(1))
