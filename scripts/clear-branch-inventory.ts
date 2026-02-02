#!/usr/bin/env tsx

/**
 * Clear Legacy Branch Inventory Data
 * 
 * This script soft-deletes all existing branch_inventory records to start fresh.
 * Products will only show in Order Portal when explicitly assigned via "Assign to Branch".
 * 
 * Run with: npx tsx scripts/clear-branch-inventory.ts
 */

import { db } from "../lib/db"
import { branchInventory } from "../db/schema"
import { sql, isNull } from "drizzle-orm"

async function clearBranchInventory() {
    console.log("🔄 Clearing legacy branch inventory data...")

    try {
        // Count existing records first
        const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(branchInventory)
            .where(isNull(branchInventory.deletedAt))

        const existingCount = countResult[0].count
        console.log(`Found ${existingCount} active branch inventory records`)

        if (existingCount === 0) {
            console.log("✅ No records to clear")
            return
        }

        // Soft-delete all records by setting deletedAt
        const result = await db.update(branchInventory)
            .set({ deletedAt: new Date() })
            .where(isNull(branchInventory.deletedAt))
            .returning({ id: branchInventory.id })

        console.log(`✅ Soft-deleted ${result.length} branch inventory records`)
        console.log("")
        console.log("📋 Next steps:")
        console.log("   1. Order Portal will now show 0 products")
        console.log("   2. Use 'Assign to Branch' to explicitly assign products")
        console.log("   3. Only assigned products will appear in Order Portal")

    } catch (error) {
        console.error("❌ Error clearing branch inventory:", error)
        throw error
    }
}

async function main() {
    console.log("🚀 Starting branch inventory cleanup...")
    console.log("")

    try {
        await clearBranchInventory()
        console.log("")
        console.log("✅ Cleanup completed successfully!")
    } catch (error) {
        console.error("❌ Cleanup failed:", error)
        process.exit(1)
    } finally {
        process.exit(0)
    }
}

// Run if executed directly
main()
