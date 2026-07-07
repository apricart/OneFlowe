/**
 * Create a SUPER_ADMIN user.
 * Usage: npx tsx scripts/create-super-admin.ts <email> <password> [fullName]
 */

import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

async function main() {
  const { db } = await import("../lib/db")
  const { users, roles } = await import("../db/schema")
  const { eq } = await import("drizzle-orm")
  const bcrypt = (await import("bcryptjs")).default

  const [email, password, fullName] = process.argv.slice(2)

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-super-admin.ts <email> <password> [fullName]")
    process.exit(1)
  }

  const [superAdminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "SUPER_ADMIN"))
    .limit(1)

  if (!superAdminRole) {
    throw new Error("SUPER_ADMIN role not found — run npm run db:seed first")
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    console.log(`ℹ️  User already exists: ${email} (id: ${existing[0].id})`)
    process.exit(0)
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      roleId: superAdminRole.id,
      fullName: fullName || email.split("@")[0],
      isActive: true,
    })
    .returning()

  console.log(`✅ Created super admin: ${created.email} (id: ${created.id})`)
  process.exit(0)
}

main().catch((error) => {
  console.error("❌ Failed:", error)
  process.exit(1)
})
