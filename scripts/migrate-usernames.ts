import { db } from "../lib/db"
import { users, employeeCredentials } from "../db/schema"
import { eq, isNull, and, or } from "drizzle-orm"

async function generateUniqueUsername(base: string, table: any): Promise<string> {
  let username = base.toLowerCase().replace(/[^a-z0-9]/g, "")
  let counter = 1
  let currentUsername = username

  while (true) {
    const [existing] = await db
      .select()
      .from(table)
      .where(eq(table.username, currentUsername))
      .limit(1)

    if (!existing) return currentUsername
    currentUsername = `${username}${counter}`
    counter++
  }
}

async function migrate() {
  console.log("Starting username migration...")

  // Migrate Users
  const allUsers = await db.select().from(users).where(isNull(users.username))
  console.log(`Found ${allUsers.length} users to migrate.`)

  for (const user of allUsers) {
    const base = `${user.firstName || ""}${user.lastName || ""}` || "user"
    const uniqueUsername = await generateUniqueUsername(base, users)
    await db.update(users).set({ username: uniqueUsername }).where(eq(users.id, user.id))
    console.log(`User ${user.id}: Assigned username '${uniqueUsername}'`)
  }

  // Migrate Employee Credentials
  const allEmployees = await db.select().from(employeeCredentials).where(isNull(employeeCredentials.username))
  console.log(`Found ${allEmployees.length} employees to migrate.`)

  for (const emp of allEmployees) {
    const base = `${emp.firstName || ""}${emp.lastName || ""}` || "employee"
    const uniqueUsername = await generateUniqueUsername(base, employeeCredentials)
    await db.update(employeeCredentials).set({ username: uniqueUsername }).where(eq(employeeCredentials.id, emp.id))
    console.log(`Employee ${emp.id}: Assigned username '${uniqueUsername}'`)
  }

  console.log("Migration completed successfully.")
}

migrate().catch(err => {
  console.error("Migration failed:", err)
  process.exit(1)
})
