import { db } from "./lib/db"
import { users } from "./db/schema"
import { eq } from "drizzle-orm"

async function testUpdate() {
    const userId = "4ca31b7e-f716-419d-85ba-2fd4be8b86cc"
    console.log("Testing update for user:", userId)

    try {
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
        if (!user) {
            console.log("User not found")
            return
        }
        console.log("Found user:", user.email)

        const result = await db.update(users).set({
            updatedAt: new Date(),
            isActive: !user.isActive
        }).where(eq(users.id, userId)).returning()

        console.log("Update success:", result[0].id, "New status:", result[0].isActive)
    } catch (err) {
        console.error("Update failed:", err)
    }
}

testUpdate().then(() => process.exit(0))
