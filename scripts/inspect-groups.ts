const dotenv = require("dotenv")
dotenv.config({ path: ".env.local" })
import { db } from "../lib/db"
import { groups } from "../db/schema"
import { desc } from "drizzle-orm"

async function inspect() {
    console.log("Inspecting groups...")
    try {
        const allGroups = await db.select().from(groups).orderBy(desc(groups.createdAt)).limit(10)
        console.table(allGroups)
    } catch (error) {
        console.error("Failed to fetch groups:", error)
    }
    process.exit(0)
}

inspect()
