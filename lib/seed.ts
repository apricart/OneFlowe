/**
 * Unified Database Seeding Script
 * Creates: Admin user, Roles, Permissions, and Organization Settings
 */

import dotenv from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

// Load environment variables
const envPath = existsSync(resolve(process.cwd(), ".env.local"))
  ? resolve(process.cwd(), ".env.local")
  : resolve(process.cwd(), ".env")
dotenv.config({ path: envPath })

import { db } from "./db"
import { users, roles, rolePermissions, organizations, organizationSettings } from "@/db/schema"
import { eq } from "drizzle-orm"
import { ROLE_TEMPLATES, Permission } from "./permissions"
import bcrypt from "bcryptjs"

// Default organization settings
const DEFAULT_SETTINGS = [
  { key: "default_currency", value: "USD" },
  { key: "tax_rate", value: 0 },
  { key: "auto_approve_orders", value: false },
  { key: "order_approval_threshold", value: 10000 },
  { key: "require_mfa", value: false },
  { key: "session_timeout_minutes", value: 60 },
  { key: "low_stock_threshold", value: 10 },
  { key: "enable_notifications", value: true },
]

async function seed() {
  console.log("🌱 Starting database seed...\n")

  try {
    // 1. Create Roles
    console.log("📝 Step 1: Creating roles...")
    const roleNames = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"]
    const createdRoles = []

    for (const roleName of roleNames) {
      const existing = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1)
      
      if (existing.length === 0) {
        const [role] = await db.insert(roles).values({
          name: roleName,
          description: ROLE_TEMPLATES[roleName as keyof typeof ROLE_TEMPLATES]?.description || "",
          permissions: {},
        }).returning()
        createdRoles.push(role)
        console.log(`  ✅ Created role: ${roleName}`)
      } else {
        createdRoles.push(existing[0])
        console.log(`  ℹ️  Role already exists: ${roleName}`)
      }
    }

    // 2. Seed Permissions
    console.log("\n📝 Step 2: Seeding role permissions...")
    const allRoles = await db.select().from(roles)

    for (const role of allRoles) {
      let templatePermissions: Permission[] = []
      
      if (role.name === "SUPER_ADMIN") {
        templatePermissions = ROLE_TEMPLATES.SUPER_ADMIN.permissions as Permission[]
      } else if (role.name === "HEAD_OFFICE") {
        templatePermissions = ROLE_TEMPLATES.HEAD_OFFICE.permissions as Permission[]
      } else if (role.name === "BRANCH_ADMIN") {
        templatePermissions = ROLE_TEMPLATES.BRANCH_ADMIN.permissions as Permission[]
      } else {
        continue
      }

      // Delete existing permissions
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id))

      // Insert new permissions
      if (templatePermissions.length > 0) {
        const permissionValues = templatePermissions.map((key) => ({
          roleId: role.id,
          permissionKey: key,
          allowed: true,
        }))

        await db.insert(rolePermissions).values(permissionValues)
        
        // Update role's permissions JSONB field
        const permissionsObj = templatePermissions.reduce((acc, key) => {
          acc[key] = true
          return acc
        }, {} as Record<string, boolean>)

        await db.update(roles).set({
          permissions: permissionsObj,
          updatedAt: new Date(),
        }).where(eq(roles.id, role.id))
        
        console.log(`  ✅ ${role.name}: ${templatePermissions.length} permissions`)
      }
    }

    // 3. Create Super Admin User
    console.log("\n📝 Step 3: Creating super admin user...")
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@example.com"
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "admin123"

    const superAdminRole = await db.select().from(roles).where(eq(roles.name, "SUPER_ADMIN")).limit(1)
    
    if (superAdminRole.length === 0) {
      throw new Error("SUPER_ADMIN role not found")
    }

    const existingAdmin = await db.select().from(users).where(eq(users.email, superAdminEmail)).limit(1)

    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash(superAdminPassword, 10)
      
      await db.insert(users).values({
        email: superAdminEmail,
        passwordHash,
        roleId: superAdminRole[0].id,
        fullName: "Super Admin",
        isActive: true,
      })
      
      console.log(`  ✅ Created super admin: ${superAdminEmail}`)
    } else {
      console.log(`  ℹ️  Super admin already exists: ${superAdminEmail}`)
    }

    // 4. Seed Organization Settings
    console.log("\n📝 Step 4: Seeding organization settings...")
    const allOrgs = await db.select().from(organizations)

    if (allOrgs.length === 0) {
      console.log("  ⚠️  No organizations found - skipping settings")
    } else {
      for (const org of allOrgs) {
        const existingSettings = await db
          .select()
          .from(organizationSettings)
          .where(eq(organizationSettings.organizationId, org.id))
        
        const existingKeys = new Set(existingSettings.map(s => s.key))
        let addedCount = 0

        for (const setting of DEFAULT_SETTINGS) {
          if (!existingKeys.has(setting.key)) {
            await db.insert(organizationSettings).values({
              organizationId: org.id,
              key: setting.key,
              value: setting.value,
            })
            addedCount++
          }
        }

        if (addedCount > 0) {
          console.log(`  ✅ ${org.name}: Added ${addedCount} settings`)
        } else {
          console.log(`  ℹ️  ${org.name}: Settings already exist`)
        }
      }
    }

    // Summary
    const totalPermissions = await db.select().from(rolePermissions)
    const totalSettings = await db.select().from(organizationSettings)
    
    console.log("\n✨ Seeding complete!")
    console.log("\n📊 Summary:")
    console.log(`  • Roles: ${allRoles.length}`)
    console.log(`  • Permissions: ${totalPermissions.length}`)
    console.log(`  • Admin Users: 1`)
    console.log(`  • Organizations: ${allOrgs.length}`)
    console.log(`  • Settings: ${totalSettings.length}`)
    console.log("\n🚀 You can now login with:")
    console.log(`  Email: ${superAdminEmail}`)
    console.log(`  Password: ${superAdminPassword}`)
    
    return { success: true }
  } catch (error) {
    console.error("\n❌ Error seeding database:", error)
    throw error
  }
}

// Run if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log("\n✅ Done!")
      process.exit(0)
    })
    .catch((error) => {
      console.error("\n❌ Failed:", error)
      process.exit(1)
    })
}

export { seed }

