/**
 * RBAC & RLS Testing Script
 * Tests 4-tier RBAC: SUPER_ADMIN, HEAD_OFFICE, BRANCH_ADMIN, ORDER_PORTAL
 * Run: npx tsx scripts/test-rbac.ts
 */
import { Pool } from "pg"
import bcrypt from "bcryptjs"

const DB_CONFIG = {
  host: "aws-1-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.csxwfjwjkxqytobgzrtt",
  password: "fv9g!Kp8?,/$tDk",
  ssl: { rejectUnauthorized: false },
}

async function testRBAC() {
  console.log("🧪 Testing 4-Tier RBAC System\n")
  
  const pool = new Pool(DB_CONFIG)
  const client = await pool.connect()
  
  try {
    // ==========================================
    // 1. VERIFY ROLES EXIST
    // ==========================================
    console.log("📋 1. Checking Roles...")
    const roles = await client.query("SELECT id, name, description FROM roles ORDER BY id")
    console.table(roles.rows)
    
    // ==========================================
    // 2. VERIFY RLS POLICIES EXIST
    // ==========================================
    console.log("\n📋 2. Checking RLS Policies...")
    const policies = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `)
    console.log(`Total RLS policies: ${policies.rows.length}`)
    policies.rows.forEach(p => {
      console.log(`  📄 ${p.tablename}: ${p.policyname} (${p.cmd})`)
    })
    
    // ==========================================
    // 3. CREATE TEST USERS FOR EACH ROLE
    // ==========================================
    console.log("\n👥 3. Creating Test Users for Each Role...")
    
    // Get org and branch
    const orgResult = await client.query("SELECT id, name FROM organizations LIMIT 1")
    const org = orgResult.rows[0]
    
    const branchResult = await client.query("SELECT id, name FROM branches WHERE organization_id = $1 LIMIT 1", [org.id])
    const branch = branchResult.rows[0]
    
    console.log(`Using Organization: ${org.name} (ID: ${org.id})`)
    console.log(`Using Branch: ${branch.name} (ID: ${branch.id})`)
    
    // Get role IDs
    const roleMap: Record<string, number> = {}
    for (const role of roles.rows) {
      roleMap[role.name] = role.id
    }
    
    const testUsers = [
      { username: "headoffice", password: "Head@123", role: "HEAD_OFFICE", roleId: roleMap["HEAD_OFFICE"], orgId: org.id, branchId: null },
      { username: "branchadmin", password: "Branch@123", role: "BRANCH_ADMIN", roleId: roleMap["BRANCH_ADMIN"], orgId: org.id, branchId: branch.id },
      { username: "orderportal", password: "Order@123", role: "ORDER_PORTAL", roleId: roleMap["ORDER_PORTAL"], orgId: org.id, branchId: branch.id },
    ]
    
    for (const user of testUsers) {
      const existing = await client.query("SELECT id FROM users WHERE username = $1", [user.username])
      
      if (existing.rows.length > 0) {
        console.log(`  ⚠️ ${user.username} already exists, updating password...`)
        const hash = await bcrypt.hash(user.password, 10)
        await client.query("UPDATE users SET password_hash = $1 WHERE username = $2", [hash, user.username])
      } else {
        console.log(`  ✅ Creating ${user.username} (${user.role})...`)
        const hash = await bcrypt.hash(user.password, 10)
        await client.query(
          `INSERT INTO users (id, email, username, password_hash, role_id, organization_id, branch_id, is_active, full_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [crypto.randomUUID(), `${user.username}@apricart.com`, user.username, hash, user.roleId, user.orgId, user.branchId, true, `${user.role} User`]
        )
      }
    }
    
    // ==========================================
    // 4. TEST RLS POLICIES (SIMPLIFIED)
    // ==========================================
    console.log("\n🔒 4. Testing RLS Policies...")
    
    // Check total orgs visible without RLS (Super Admin bypass)
    const totalOrgs = await client.query("SELECT COUNT(*) as count FROM organizations")
    console.log(`\n  📊 Total organizations in database: ${totalOrgs.rows[0].count}`)
    
    // Test RLS by checking policies are applied
    const rlsEnabledTables = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND rowsecurity = true
      ORDER BY tablename
    `)
    console.log(`  ✅ ${rlsEnabledTables.rows.length} tables have RLS enabled`)
    
    // Show some key tables with RLS
    console.log("\n  Key tables with RLS protection:")
    const keyTables = ['users', 'orders', 'organizations', 'branches', 'products']
    for (const table of keyTables) {
      const hasRLS = rlsEnabledTables.rows.some(r => r.tablename === table)
      console.log(`    ${hasRLS ? '✅' : '❌'} ${table}`)
    }
    
    // ==========================================
    // 5. VERIFY USER TABLE
    // ==========================================
    console.log("\n👤 5. All Users in Database:")
    const allUsers = await client.query(`
      SELECT u.username, u.full_name, r.name as role, o.name as org, b.name as branch, u.is_active
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN branches b ON u.branch_id = b.id
      ORDER BY r.id
    `)
    console.table(allUsers.rows)
    
    // ==========================================
    // SUMMARY
    // ==========================================
    console.log("\n" + "=".repeat(60))
    console.log("✅ RBAC TESTING COMPLETE!")
    console.log("=".repeat(60))
    console.log("\n📋 Test User Credentials:")
    console.log("  SUPER_ADMIN:  superadmin / admin123")
    console.log("  SUPER_ADMIN:  yousuf / Y@usufza8901")
    console.log("  HEAD_OFFICE:  headoffice / Head@123")
    console.log("  BRANCH_ADMIN: branchadmin / Branch@123")
    console.log("  ORDER_PORTAL: orderportal / Order@123")
    console.log("\n🎯 Next Steps:")
    console.log("  1. Login with each user to test role-based access")
    console.log("  2. Verify users only see their allowed data")
    console.log("  3. Test API endpoints with different roles")
    console.log("=".repeat(60))
    
  } catch (error) {
    console.error("\n❌ Test failed:", error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

testRBAC().catch(() => process.exit(1))
