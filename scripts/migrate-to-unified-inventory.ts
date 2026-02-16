#!/usr/bin/env tsx

/**
 * Data Migration Script: Migrate from old inventory tables to unified structure
 * 
 * This script migrates data from:
 * - organizationProducts -> organizationInventory
 * - branchProducts -> branchInventory
 * 
 * Run with: npx tsx scripts/migrate-to-unified-inventory.ts
 */

import { db } from "../lib/db"
import { organizationProducts, branchProducts, organizationInventory, branchInventory, globalProducts, organizations, branches } from "../db/schema"
import { eq, and, isNull } from "drizzle-orm"

async function migrateOrganizationProducts() {
  console.log("🔄 Migrating organization products...")

  try {
    // Get all organization products that don't have a corresponding organization inventory
    const orgProducts = await db.select()
      .from(organizationProducts)
      .leftJoin(organizationInventory,
        and(
          eq(organizationProducts.organizationId, organizationInventory.organizationId),
          eq(organizationProducts.globalProductId, organizationInventory.globalProductId)
        )
      )
      .where(isNull(organizationInventory.id))

    console.log(`Found ${orgProducts.length} organization products to migrate`)

    if (orgProducts.length === 0) {
      console.log("✅ No organization products to migrate")
      return
    }

    // Migrate each organization product
    for (const orgProduct of orgProducts as any[]) {
      const { organization_products: product, organization_inventory: existing } = orgProduct

      if (existing) continue // Skip if already migrated

      await db.insert(organizationInventory).values({
        organizationId: product.organizationId,
        globalProductId: product.globalProductId,
        assignedByUserId: product.updatedByUserId || "00000000-0000-0000-0000-000000000000",
        isActive: product.isEnabled,
        customName: product.customName,
        customPrice: product.customPrice,
        customDescription: product.customDescription,
        customImageUrl: product.customImageUrl,
        assignedAt: product.createdAt,
        updatedAt: product.updatedAt,
      })
    }

    console.log(`✅ Migrated ${orgProducts.length} organization products`)
  } catch (error) {
    console.error("❌ Error migrating organization products:", error)
    throw error
  }
}

async function migrateBranchProducts() {
  console.log("🔄 Migrating branch products...")

  try {
    // Get all branch products that don't have a corresponding branch inventory
    const branchProductsList = await db.select()
      .from(branchProducts)
      .leftJoin(branchInventory,
        and(
          eq(branchProducts.branchId, branchInventory.branchId),
          eq(branchProducts.organizationProductId, branchInventory.organizationInventoryId)
        )
      )
      .where(isNull(branchInventory.id))

    console.log(`Found ${branchProductsList.length} branch products to migrate`)

    if (branchProductsList.length === 0) {
      console.log("✅ No branch products to migrate")
      return
    }

    // Migrate each branch product
    for (const branchProduct of branchProductsList as any[]) {
      const { branch_products: product, branch_inventory: existing } = branchProduct

      if (existing) continue // Skip if already migrated

      // Find the corresponding organization inventory
      const orgInventory = await db.select()
        .from(organizationInventory)
        .where(
          and(
            eq(organizationInventory.organizationId, product.organizationId),
            eq(organizationInventory.globalProductId, product.globalProductId)
          )
        )
        .limit(1)

      if (orgInventory.length === 0) {
        console.warn(`⚠️  No organization inventory found for branch product ${product.id}, skipping`)
        continue
      }

      await db.insert(branchInventory).values({
        branchId: product.branchId,
        organizationId: product.organizationId,
        organizationInventoryId: (orgInventory[0] as any).id,
        assignedByUserId: product.updatedByUserId || "00000000-0000-0000-0000-000000000000",
        isVisible: product.isVisible,
        isActive: product.isAvailable,
        assignedAt: product.createdAt,
        updatedAt: product.updatedAt,
      } as any)
    }

    console.log(`✅ Migrated ${branchProductsList.length} branch products`)
  } catch (error) {
    console.error("❌ Error migrating branch products:", error)
    throw error
  }
}

async function cleanupOldTables() {
  console.log("🧹 Cleaning up old tables...")

  try {
    // Drop old tables (be careful in production!)
    await db.execute(`DROP TABLE IF EXISTS branch_products CASCADE`)
    await db.execute(`DROP TABLE IF EXISTS organization_products CASCADE`)

    console.log("✅ Old tables cleaned up")
  } catch (error) {
    console.error("❌ Error cleaning up old tables:", error)
    throw error
  }
}

async function main() {
  console.log("🚀 Starting inventory migration...")

  try {
    await migrateOrganizationProducts()
    await migrateBranchProducts()

    // Only cleanup in development - comment out for production
    if (process.env.NODE_ENV === 'development') {
      await cleanupOldTables()
    } else {
      console.log("⚠️  Skipping table cleanup in production environment")
    }

    console.log("✅ Migration completed successfully!")
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  main()
}

export { migrateOrganizationProducts, migrateBranchProducts, cleanupOldTables }
