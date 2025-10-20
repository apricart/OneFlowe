import { db } from "@/lib/db"
import { 
  globalProducts, 
  organizationProducts, 
  branchProducts, 
  organizationInventory, 
  branchInventory,
  organizations,
  branches
} from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"

async function migrateInventoryData() {
  console.log("Starting inventory data migration...")

  try {
    // Step 1: Migrate organization_products to organization_inventory
    console.log("Migrating organization products to organization inventory...")
    
    const orgProducts = await db.select().from(organizationProducts)
    console.log(`Found ${orgProducts.length} organization products to migrate`)

    for (const orgProduct of orgProducts) {
      try {
        await db.insert(organizationInventory).values({
          organizationId: orgProduct.organizationId,
          globalProductId: orgProduct.globalProductId,
          assignedByUserId: orgProduct.updatedByUserId || "00000000-0000-0000-0000-000000000000", // Default UUID for migration
          isActive: orgProduct.isEnabled,
          customName: orgProduct.customName,
          customPrice: orgProduct.customPrice,
          customDescription: orgProduct.customDescription,
          customImageUrl: orgProduct.customImageUrl,
          assignedAt: orgProduct.createdAt || new Date(),
          updatedAt: orgProduct.updatedAt || new Date(),
        })
      } catch (error) {
        console.error(`Error migrating organization product ${orgProduct.id}:`, error)
      }
    }

    console.log("Organization products migration completed")

    // Step 2: Migrate branch_products to branch_inventory
    console.log("Migrating branch products to branch inventory...")
    
    const branchProductsData = await db.select().from(branchProducts)
    console.log(`Found ${branchProductsData.length} branch products to migrate`)

    for (const branchProduct of branchProductsData) {
      try {
        // Find the corresponding organization inventory item
        const orgInventoryItem = await db.query.organizationInventory.findFirst({
          where: and(
            eq(organizationInventory.organizationId, branchProduct.organizationId),
            eq(organizationInventory.globalProductId, branchProduct.globalProductId)
          )
        })

        if (!orgInventoryItem) {
          console.warn(`No organization inventory found for branch product ${branchProduct.id}`)
          continue
        }

        await db.insert(branchInventory).values({
          branchId: branchProduct.branchId,
          organizationId: branchProduct.organizationId,
          organizationInventoryId: orgInventoryItem.id,
          globalProductId: branchProduct.globalProductId,
          assignedByUserId: branchProduct.updatedByUserId || "00000000-0000-0000-0000-000000000000", // Default UUID for migration
          isVisible: branchProduct.isAvailable, // Map isAvailable to isVisible
          isActive: branchProduct.isAvailable,
          stockQuantity: branchProduct.stockQuantity,
          reorderThreshold: branchProduct.reorderThreshold,
          assignedAt: branchProduct.createdAt || new Date(),
          updatedAt: branchProduct.updatedAt || new Date(),
        })
      } catch (error) {
        console.error(`Error migrating branch product ${branchProduct.id}:`, error)
      }
    }

    console.log("Branch products migration completed")

    // Step 3: Verify migration
    console.log("Verifying migration...")
    
    const [orgInventoryCount] = await db.select({ count: sql<number>`count(*)` }).from(organizationInventory)
    const [branchInventoryCount] = await db.select({ count: sql<number>`count(*)` }).from(branchInventory)
    
    console.log(`Organization inventory items: ${orgInventoryCount.count}`)
    console.log(`Branch inventory items: ${branchInventoryCount.count}`)

    console.log("Migration completed successfully!")
    
  } catch (error) {
    console.error("Migration failed:", error)
    throw error
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateInventoryData()
    .then(() => {
      console.log("Migration script completed")
      process.exit(0)
    })
    .catch((error) => {
      console.error("Migration script failed:", error)
      process.exit(1)
    })
}

export { migrateInventoryData }
