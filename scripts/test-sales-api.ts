/**
 * Test sales-performance API directly
 * Run: npx tsx scripts/test-sales-api.ts
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

async function testSalesAPI() {
  console.log("🔍 Testing Sales Performance API Logic\n")
  
  const pool = new Pool(DB_CONFIG)
  const client = await pool.connect()
  
  try {
    // Simulate the exact query from the API
    const startDate = new Date("2015-01-01T00:00:00.000Z")
    const endDate = new Date("2026-04-10T13:48:29.093Z")
    
    console.log("1️⃣ Testing date range query:")
    console.log(`   Start: ${startDate.toISOString()}`)
    console.log(`   End: ${endDate.toISOString()}`)
    
    // Test the conditions building
    const conditions: any[] = []
    // This is what the API does:
    // conditions.push(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate))
    
    const testQuery = await client.query(`
      SET SESSION row_security = off;
      
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_cents) / 100 as total_sales
      FROM orders
      WHERE created_at >= $1 
        AND created_at <= $2
    `, [startDate, endDate])
    
    console.log("\n   Result:", testQuery.rows[0])
    
    // Test the series query (the main one that might be failing)
    console.log("\n2️⃣ Testing series query with timezone:")
    const seriesQuery = await client.query(`
      SET SESSION row_security = off;
      
      SELECT 
        date_trunc('year', (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi') as bucket,
        TO_CHAR((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi', 'YYYY') as label,
        SUM(total_cents) as total_sales,
        COUNT(1) as order_count
      FROM orders
      WHERE created_at >= $1 
        AND created_at <= $2
      GROUP BY 1, 2
      ORDER BY 1
    `, [startDate, endDate])
    
    console.log("   Series Data:", seriesQuery.rows)
    
    // Test branch sales query (the one with leftJoin)
    console.log("\n3️⃣ Testing branch sales query:")
    const branchQuery = await client.query(`
      SET SESSION row_security = off;
      
      SELECT 
        b.id as branch_id,
        b.name as branch_name,
        SUM(o.total_cents) as total_sales,
        COUNT(o.id) as order_count
      FROM branches b
      LEFT JOIN orders o ON o.branch_id = b.id 
        AND o.created_at >= $1 
        AND o.created_at <= $2
        AND UPPER(o.status) IN ('APPROVED', 'FULFILLED', 'REFUNDED', 'PENDING', 'REJECTED', 'CANCELLED')
      GROUP BY b.id, b.name
      ORDER BY total_sales DESC NULLS LAST
      LIMIT 20
    `, [startDate, endDate])
    
    console.log("   Branch Data:", branchQuery.rows)
    
    console.log("\n✅ All queries executed successfully!")
    console.log("\n🔍 If queries work here but API returns 400, the issue is in:")
    console.log("   - Parameter parsing")
    console.log("   - Date string to Date object conversion")
    console.log("   - RLS/SuperAdmin wrapper")
    console.log("   - SQL condition building with Drizzle")
    
  } catch (error) {
    console.error("\n❌ Query failed:", error)
  } finally {
    client.release()
    await pool.end()
  }
}

testSalesAPI().catch(() => process.exit(1))
