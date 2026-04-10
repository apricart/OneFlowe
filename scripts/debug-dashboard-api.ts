/**
 * Debug Dashboard API - Check why KPI cards show 0 but sidebar shows data
 * Run: npx tsx scripts/debug-dashboard-api.ts
 */
import { Pool } from "pg"

const DB_CONFIG = {
  host: "aws-1-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.csxwfjwjkxqytobgzrtt",
  password: "fv9g!Kp8?,/$tDk",
  ssl: { rejectUnauthorized: false },
}

async function debugDashboard() {
  console.log("🔍 Debugging Dashboard Data Discrepancy\n")
  
  const pool = new Pool(DB_CONFIG)
  const client = await pool.connect()
  
  try {
    // 1. Check total orders as SUPER_ADMIN (RLS off)
    console.log("1️⃣ Total Orders (Super Admin - No RLS):")
    const totalOrders = await client.query(`
      SET SESSION row_security = off;
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN UPPER(status) = 'FULFILLED' THEN 1 END) as fulfilled,
        COUNT(CASE WHEN UPPER(status) = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN UPPER(status) = 'APPROVED' THEN 1 END) as approved,
        SUM(total_cents) / 100 as total_revenue
      FROM orders
    `)
    console.table(totalOrders.rows)
    
    // 2. Check orders by organization
    console.log("\n2️⃣ Orders by Organization:")
    const orgOrders = await client.query(`
      SELECT 
        o.id as org_id,
        o.name as org_name,
        COUNT(ord.id) as order_count,
        SUM(ord.total_cents) / 100 as revenue
      FROM organizations o
      LEFT JOIN orders ord ON ord.organization_id = o.id
      GROUP BY o.id, o.name
    `)
    console.table(orgOrders.rows)
    
    // 3. Check orders by branch
    console.log("\n3️⃣ Orders by Branch:")
    const branchOrders = await client.query(`
      SELECT 
        b.id as branch_id,
        b.name as branch_name,
        b.organization_id,
        COUNT(ord.id) as order_count
      FROM branches b
      LEFT JOIN orders ord ON ord.branch_id = b.id
      GROUP BY b.id, b.name, b.organization_id
      ORDER BY order_count DESC
    `)
    console.table(branchOrders.rows)
    
    // 4. Simulate what the KPI query does (with RLS on as SUPER_ADMIN)
    console.log("\n4️⃣ Simulating KPI Query (withSuperAdmin context):")
    await client.query(`SET SESSION row_security = off`)
    
    // This is what the API tries to do
    const kpiQuery = await client.query(`
      SELECT 
        COALESCE(SUM(total_cents), 0) / 100 as total_sales,
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN UPPER(status) = 'REFUNDED' THEN 1 ELSE 0 END), 0) as refunded_count,
        COALESCE(SUM(CASE WHEN UPPER(status) IN ('REJECTED', 'CANCELLED') THEN 1 ELSE 0 END), 0) as rejected_count,
        COALESCE(SUM(CASE WHEN UPPER(status) = 'APPROVED' THEN 1 ELSE 0 END), 0) as approved_count
      FROM orders
      WHERE created_at >= '1970-01-01'
    `)
    console.table(kpiQuery.rows)
    
    // 5. Check if there are date filter issues
    console.log("\n5️⃣ Order Date Range:")
    const dateRange = await client.query(`
      SELECT 
        MIN(created_at) as earliest,
        MAX(created_at) as latest,
        COUNT(*) as total
      FROM orders
    `)
    console.table(dateRange.rows)
    
    // 6. Check recent orders
    console.log("\n6️⃣ Recent Orders (Last 10):")
    const recentOrders = await client.query(`
      SELECT 
        tid,
        status,
        total_cents / 100 as amount,
        branch_id,
        organization_id,
        created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 10
    `)
    console.table(recentOrders.rows)
    
    // 7. Check what happens with RLS ON as HEAD_OFFICE
    console.log("\n7️⃣ Simulating HEAD_OFFICE RLS (should see org 2 only):")
    await client.query(`
      SET SESSION row_security = on;
      SET SESSION "app.current_role" = 'HEAD_OFFICE';
      SET SESSION "app.current_org_id" = '2';
    `)
    
    const headOfficeView = await client.query(`
      SELECT COUNT(*) as visible_orders FROM orders
    `)
    console.log(`   HEAD_OFFICE sees: ${headOfficeView.rows[0].visible_orders} orders`)
    
    // 8. Check BRANCH_ADMIN view
    console.log("\n8️⃣ Simulating BRANCH_ADMIN RLS (org 2, branch 2):")
    await client.query(`
      SET SESSION "app.current_role" = 'BRANCH_ADMIN';
      SET SESSION "app.current_org_id" = '2';
      SET SESSION "app.current_branch_id" = '2';
    `)
    
    const branchAdminView = await client.query(`
      SELECT COUNT(*) as visible_orders FROM orders
    `)
    console.log(`   BRANCH_ADMIN sees: ${branchAdminView.rows[0].visible_orders} orders`)
    
    console.log("\n" + "=".repeat(60))
    console.log("✅ Debug Complete!")
    console.log("=".repeat(60))
    console.log("\n🔎 Findings:")
    console.log(`   - Total Orders: ${totalOrders.rows[0].total}`)
    console.log(`   - Total Revenue: Rs ${totalOrders.rows[0].total_revenue}`)
    console.log(`   - Date Range: ${dateRange.rows[0].earliest} to ${dateRange.rows[0].latest}`)
    console.log("\n💡 If KPI Query (step 4) shows 0 but Total Orders (step 1) shows > 0,")
    console.log("   the issue is in the API's WHERE clause conditions!")
    console.log("=".repeat(60))
    
  } catch (error) {
    console.error("\n❌ Debug failed:", error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

debugDashboard().catch(() => process.exit(1))
