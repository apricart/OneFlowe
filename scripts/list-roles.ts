import dotenv from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

// Load environment variables
const envPath = existsSync(resolve(process.cwd(), ".env.local"))
    ? resolve(process.cwd(), ".env.local")
    : resolve(process.cwd(), ".env")
dotenv.config({ path: envPath })

async function main() {
    const { db } = await import("../lib/db")
    const { roles, organizations, users } = await import("../db/schema")
    const { eq } = await import("drizzle-orm")

    const allOrgs = await db.select().from(organizations).limit(1)
    const org = allOrgs[0]

    if (!org) {
        console.error("ERROR: No organizations found!")
        process.exit(1)
    }

    const testRole = "HEAD_OFFICE"
    const [roleRow] = await db.select().from(roles).where(eq(roles.name, testRole)).limit(1)

    if (!roleRow) {
        console.error(`ERROR: Role "${testRole}" not found in database!`)
    } else {
        console.log(`SUCCESS: Found role "${testRole}" with ID ${roleRow.id}`)

        try {
            console.log("\nSimulating user insertion (REAL INSERT)...")
            const testEmail = `test_${Date.now()}@example.com`
            const newUser = {
                email: testEmail,
                passwordHash: "dummy_hash",
                roleId: roleRow.id,
                firstName: "Test",
                lastName: "User",
                fullName: "Test User",
                organizationId: org.id,
                isActive: true
            }
            console.log("Using payload:", newUser)
            const [inserted] = await db.insert(users).values(newUser).returning()
            console.log("Insert successful! User ID:", inserted.id)

            // Cleanup our test user
            await db.delete(users).where(eq(users.id, inserted.id))
            console.log("Test user cleaned up.")
        } catch (e) {
            console.error("Simulation failed with error:", e)
        }
    }
    process.exit(0)
}

main().catch(console.error)
