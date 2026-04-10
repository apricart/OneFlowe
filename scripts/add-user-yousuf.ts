/**
 * Add new SUPER_ADMIN user: yousuf / Y@usufza8901
 * Run: npx tsx scripts/add-user-yousuf.ts
 */
import { Pool } from "pg"
import bcrypt from "bcryptjs"

// Database config
const DB_CONFIG = {
  host: "aws-1-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.csxwfjwjkxqytobgzrtt",
  password: "fv9g!Kp8?,/$tDk",
  ssl: { rejectUnauthorized: false },
}

async function addUser() {
  console.log("👤 Adding new SUPER_ADMIN user: yousuf\n")
  
  const pool = new Pool(DB_CONFIG)
  const client = await pool.connect()
  
  try {
    await client.query("BEGIN")
    
    // Get SUPER_ADMIN role ID
    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = $1",
      ["SUPER_ADMIN"]
    )
    
    if (roleResult.rows.length === 0) {
      console.error("❌ SUPER_ADMIN role not found!")
      process.exit(1)
    }
    
    const superAdminRoleId = roleResult.rows[0].id
    
    // Get first organization
    const orgResult = await client.query(
      "SELECT id FROM organizations LIMIT 1"
    )
    
    if (orgResult.rows.length === 0) {
      console.error("❌ No organization found!")
      process.exit(1)
    }
    
    const orgId = orgResult.rows[0].id
    
    // Get first branch
    const branchResult = await client.query(
      "SELECT id FROM branches WHERE organization_id = $1 LIMIT 1",
      [orgId]
    )
    
    const branchId = branchResult.rows[0]?.id || null
    
    // Check if user already exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE username = $1",
      ["yousuf"]
    )
    
    if (existingUser.rows.length > 0) {
      console.log("⚠️ User 'yousuf' already exists. Updating password...")
      
      // Update password
      const passwordHash = await bcrypt.hash("Y@usufza8901", 10)
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE username = $2",
        [passwordHash, "yousuf"]
      )
      
      console.log("✅ Password updated for yousuf")
    } else {
      // Create new user
      const passwordHash = await bcrypt.hash("Y@usufza8901", 10)
      
      await client.query(
        `INSERT INTO users (
          id, email, username, password_hash, role_id, 
          organization_id, branch_id, is_active, full_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          crypto.randomUUID(),
          "yousuf@apricart.com",
          "yousuf",
          passwordHash,
          superAdminRoleId,
          orgId,
          branchId,
          true,
          "Yousuf Admin"
        ]
      )
      
      console.log("✅ User created successfully!")
    }
    
    await client.query("COMMIT")
    
    console.log("\n📋 User Details:")
    console.log(`  Username: yousuf`)
    console.log(`  Password: Y@usufza8901`)
    console.log(`  Role: SUPER_ADMIN`)
    console.log(`  Organization ID: ${orgId}`)
    console.log(`  Branch ID: ${branchId}`)
    console.log("\n🚀 You can now login with these credentials!")
    
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("\n❌ Failed to add user:", error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

addUser().catch(() => process.exit(1))
