/**
 * Seed script for new Supabase database
 * Run: npx tsx scripts/seed-new-db.ts
 */
import { Pool } from "pg"
import bcrypt from "bcryptjs"

// Database config - update these values
const DB_CONFIG = {
  host: "db.csxwfjwjkxqytobgzrtt.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "fv9g!Kp8?,/$tDk",
  ssl: { rejectUnauthorized: false },
}

// Role definitions
const ROLES = [
  { name: "SUPER_ADMIN", description: "Full system access" },
  { name: "HEAD_OFFICE", description: "Organization-wide access" },
  { name: "BRANCH_ADMIN", description: "Branch-level access" },
  { name: "ORDER_PORTAL", description: "Own orders only" },
]

// Default permissions for each role
const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN: [
    "USER_CREATE", "USER_READ", "USER_UPDATE", "USER_DELETE",
    "ORGANIZATION_CREATE", "ORGANIZATION_READ", "ORGANIZATION_UPDATE", "ORGANIZATION_DELETE",
    "BRANCH_CREATE", "BRANCH_READ", "BRANCH_UPDATE", "BRANCH_DELETE",
    "PRODUCT_CREATE", "PRODUCT_READ", "PRODUCT_UPDATE", "PRODUCT_DELETE",
    "ORDER_CREATE", "ORDER_READ", "ORDER_UPDATE", "ORDER_DELETE",
    "REPORT_VIEW", "SETTINGS_MANAGE", "ROLE_MANAGE"
  ],
  HEAD_OFFICE: [
    "USER_CREATE", "USER_READ", "USER_UPDATE",
    "BRANCH_READ", "BRANCH_UPDATE",
    "PRODUCT_READ", "ORDER_READ", "ORDER_UPDATE",
    "REPORT_VIEW", "SETTINGS_VIEW"
  ],
  BRANCH_ADMIN: [
    "USER_READ",
    "BRANCH_READ",
    "PRODUCT_READ", "ORDER_CREATE", "ORDER_READ", "ORDER_UPDATE",
    "REPORT_VIEW"
  ],
  ORDER_PORTAL: [
    "ORDER_CREATE", "ORDER_READ_OWN",
    "PRODUCT_READ"
  ]
}

async function seed() {
  console.log("🌱 Seeding new database...\n")
  
  const pool = new Pool(DB_CONFIG)
  const client = await pool.connect()
  
  try {
    // Start transaction
    await client.query("BEGIN")
    
    // 1. Create Roles
    console.log("📝 Step 1: Creating roles...")
    const createdRoles: Record<string, number> = {}
    
    for (const role of ROLES) {
      const existing = await client.query(
        "SELECT id FROM roles WHERE name = $1",
        [role.name]
      )
      
      if (existing.rows.length === 0) {
        const result = await client.query(
          "INSERT INTO roles (name, description, permissions) VALUES ($1, $2, $3) RETURNING id",
          [role.name, role.description, JSON.stringify({})]
        )
        createdRoles[role.name] = result.rows[0].id
        console.log(`  ✓ Created role: ${role.name}`)
      } else {
        createdRoles[role.name] = existing.rows[0].id
        console.log(`  ⚠ Role exists: ${role.name}`)
      }
    }
    
    // 2. Create Role Permissions
    console.log("\n🔐 Step 2: Creating role permissions...")
    
    for (const [roleName, permissions] of Object.entries(DEFAULT_PERMISSIONS)) {
      const roleId = createdRoles[roleName]
      
      for (const permission of permissions) {
        const existing = await client.query(
          "SELECT id FROM role_permissions WHERE role_id = $1 AND permission_key = $2",
          [roleId, permission]
        )
        
        if (existing.rows.length === 0) {
          await client.query(
            "INSERT INTO role_permissions (role_id, permission_key, allowed) VALUES ($1, $2, true)",
            [roleId, permission]
          )
        }
      }
      console.log(`  ✓ Permissions for ${roleName}: ${permissions.length}`)
    }
    
    // 3. Create First Organization
    console.log("\n🏢 Step 3: Creating organization...")
    const orgResult = await client.query(
      "INSERT INTO organizations (name, status) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      ["Apricart", "active"]
    )
    const orgId = orgResult.rows[0]?.id || 1
    console.log(`  ✓ Organization created (ID: ${orgId})`)
    
    // 4. Create First Branch
    console.log("\n🏪 Step 4: Creating branch...")
    const branchResult = await client.query(
      "INSERT INTO branches (organization_id, name, code, status) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id",
      [orgId, "Main Branch", "MAIN", "active"]
    )
    const branchId = branchResult.rows[0]?.id || 1
    console.log(`  ✓ Branch created (ID: ${branchId})`)
    
    // 5. Create Super Admin User
    console.log("\n👤 Step 5: Creating super admin user...")
    
    // Hash password: "admin123"
    const passwordHash = await bcrypt.hash("admin123", 10)
    const superAdminRoleId = createdRoles["SUPER_ADMIN"]
    
    // Check if user already exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE email = $1",
      ["admin@apricart.com"]
    )
    
    if (existingUser.rows.length === 0) {
      await client.query(
        `INSERT INTO users (
          id, email, username, password_hash, role_id, 
          organization_id, branch_id, is_active, full_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          crypto.randomUUID(),
          "admin@apricart.com",
          "superadmin",
          passwordHash,
          superAdminRoleId,
          orgId,
          branchId,
          true,
          "System Administrator"
        ]
      )
      console.log(`  ✓ Super admin created: admin@apricart.com / admin123`)
    } else {
      console.log(`  ⚠ Super admin already exists`)
    }
    
    // 6. Create Organization Settings
    console.log("\n⚙️ Step 6: Creating organization settings...")
    
    const settings = [
      { key: "default_currency", value: "PKR" },
      { key: "tax_rate", value: "0" },
      { key: "auto_approve_orders", value: "false" },
      { key: "order_approval_threshold", value: "10000" },
      { key: "require_mfa", value: "false" },
      { key: "session_timeout_minutes", value: "60" },
      { key: "low_stock_threshold", value: "10" },
      { key: "enable_notifications", value: "true" },
    ]
    
    for (const setting of settings) {
      // Check if setting already exists
      const existingSetting = await client.query(
        "SELECT id FROM organization_settings WHERE organization_id = $1 AND key = $2",
        [orgId, setting.key]
      )
      
      if (existingSetting.rows.length === 0) {
        await client.query(
          `INSERT INTO organization_settings (organization_id, key, value) VALUES ($1, $2, $3)`,
          [orgId, setting.key, JSON.stringify(setting.value)]
        )
      }
    }
    console.log(`  ✓ ${settings.length} settings created`)
    
    // Commit transaction
    await client.query("COMMIT")
    
    console.log("\n✅ Database seeding completed successfully!")
    console.log("\n📋 Summary:")
    console.log(`  • ${Object.keys(createdRoles).length} roles created`)
    console.log(`  • Organization ID: ${orgId}`)
    console.log(`  • Branch ID: ${branchId}`)
    console.log(`  • Super Admin: admin@apricart.com / admin123`)
    console.log("\n🚀 You can now log in with these credentials.")
    
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("\n❌ Seeding failed:", error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(() => process.exit(1))
