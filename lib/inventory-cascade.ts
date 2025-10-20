import { db } from "@/lib/db"
import { organizationInventory, branchInventory, auditLogs } from "@/db/schema"
import { eq, and, isNull } from "drizzle-orm"

/**
 * Cascade utility functions for inventory management
 * Handles soft deletes and status changes across the 3-level hierarchy
 */

/**
 * Soft delete all branch inventory linked to an organization inventory item
 * @param organizationInventoryId - The organization inventory ID to cascade from
 * @param performedByUserId - User performing the action
 * @param performedByRole - Role of the user performing the action
 */
export async function cascadeOrgDeletion(
  organizationInventoryId: number,
  performedByUserId: string,
  performedByRole: string
) {
  try {
    // Find all branch inventory items linked to this org inventory
    const branchItems = await db.select({
      id: branchInventory.id,
      branchId: branchInventory.branchId,
      organizationId: branchInventory.organizationId,
    })
    .from(branchInventory)
    .where(
      and(
        eq(branchInventory.organizationInventoryId, organizationInventoryId),
        isNull(branchInventory.deletedAt)
      )
    )

    if (branchItems.length === 0) {
      return { deletedCount: 0, affectedBranches: [] }
    }

    // Soft delete all branch inventory items
    const now = new Date()
    await db.update(branchInventory)
      .set({ 
        deletedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(branchInventory.organizationInventoryId, organizationInventoryId),
          isNull(branchInventory.deletedAt)
        )
      )

    // Log the cascade deletion
    await db.insert(auditLogs).values({
      userId: performedByUserId,
      action: "CASCADE_DELETE",
      entity: "BranchInventory",
      entityId: branchItems.map(item => item.id).join(','),
      metadata: {
        triggeredBy: "organization_inventory_deletion",
        organizationInventoryId,
        deletedCount: branchItems.length,
        affectedBranches: branchItems.map(item => item.branchId),
        performedByRole
      },
    })

    return {
      deletedCount: branchItems.length,
      affectedBranches: branchItems.map(item => item.branchId)
    }
  } catch (error) {
    console.error("Error in cascadeOrgDeletion:", error)
    throw error
  }
}

/**
 * Cascade status changes from organization inventory to branch inventory
 * @param organizationInventoryId - The organization inventory ID to cascade from
 * @param isActive - New active status
 * @param performedByUserId - User performing the action
 * @param performedByRole - Role of the user performing the action
 */
export async function cascadeOrgStatusChange(
  organizationInventoryId: number,
  isActive: boolean,
  performedByUserId: string,
  performedByRole: string
) {
  try {
    // Find all branch inventory items linked to this org inventory
    const branchItems = await db.select({
      id: branchInventory.id,
      branchId: branchInventory.branchId,
      organizationId: branchInventory.organizationId,
    })
    .from(branchInventory)
    .where(
      and(
        eq(branchInventory.organizationInventoryId, organizationInventoryId),
        isNull(branchInventory.deletedAt)
      )
    )

    if (branchItems.length === 0) {
      return { updatedCount: 0, affectedBranches: [] }
    }

    // Update all branch inventory items
    const updateData: any = {
      isActive,
      updatedAt: new Date()
    }

    // If disabling, also hide from branches
    if (!isActive) {
      updateData.isVisible = false
    }

    await db.update(branchInventory)
      .set(updateData)
      .where(
        and(
          eq(branchInventory.organizationInventoryId, organizationInventoryId),
          isNull(branchInventory.deletedAt)
        )
      )

    // Log the cascade update
    await db.insert(auditLogs).values({
      userId: performedByUserId,
      action: "CASCADE_UPDATE",
      entity: "BranchInventory",
      entityId: branchItems.map(item => item.id).join(','),
      metadata: {
        triggeredBy: "organization_inventory_status_change",
        organizationInventoryId,
        isActive,
        updatedCount: branchItems.length,
        affectedBranches: branchItems.map(item => item.branchId),
        performedByRole,
        changes: updateData
      },
    })

    return {
      updatedCount: branchItems.length,
      affectedBranches: branchItems.map(item => item.branchId)
    }
  } catch (error) {
    console.error("Error in cascadeOrgStatusChange:", error)
    throw error
  }
}

/**
 * Cascade global product deletion to organization and branch inventory
 * @param globalProductId - The global product ID to cascade from
 * @param performedByUserId - User performing the action
 * @param performedByRole - Role of the user performing the action
 */
export async function cascadeGlobalProductDeletion(
  globalProductId: number,
  performedByUserId: string,
  performedByRole: string
) {
  try {
    // Find all organization inventory items for this global product
    const orgItems = await db.select({
      id: organizationInventory.id,
      organizationId: organizationInventory.organizationId,
    })
    .from(organizationInventory)
    .where(
      and(
        eq(organizationInventory.globalProductId, globalProductId),
        isNull(organizationInventory.deletedAt)
      )
    )

    if (orgItems.length === 0) {
      return { deletedOrgCount: 0, deletedBranchCount: 0, affectedOrgs: [], affectedBranches: [] }
    }

    let totalBranchDeletions = 0
    const affectedBranches: number[] = []
    const affectedOrgs = orgItems.map(item => item.organizationId)

    // Soft delete each organization inventory item and cascade to branches
    for (const orgItem of orgItems) {
      // First cascade to branches
      const branchResult = await cascadeOrgDeletion(
        orgItem.id,
        performedByUserId,
        performedByRole
      )
      totalBranchDeletions += branchResult.deletedCount
      affectedBranches.push(...branchResult.affectedBranches)

      // Then soft delete the organization inventory item
      await db.update(organizationInventory)
        .set({ 
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(organizationInventory.id, orgItem.id))
    }

    // Log the global cascade deletion
    await db.insert(auditLogs).values({
      userId: performedByUserId,
      action: "CASCADE_DELETE",
      entity: "GlobalProduct",
      entityId: globalProductId.toString(),
      metadata: {
        triggeredBy: "global_product_deletion",
        globalProductId,
        deletedOrgCount: orgItems.length,
        deletedBranchCount: totalBranchDeletions,
        affectedOrgs,
        affectedBranches: [...new Set(affectedBranches)], // Remove duplicates
        performedByRole
      },
    })

    return {
      deletedOrgCount: orgItems.length,
      deletedBranchCount: totalBranchDeletions,
      affectedOrgs,
      affectedBranches: [...new Set(affectedBranches)]
    }
  } catch (error) {
    console.error("Error in cascadeGlobalProductDeletion:", error)
    throw error
  }
}

/**
 * Cascade global product status changes to organization and branch inventory
 * @param globalProductId - The global product ID to cascade from
 * @param status - New global product status
 * @param performedByUserId - User performing the action
 * @param performedByRole - Role of the user performing the action
 */
export async function cascadeGlobalProductStatusChange(
  globalProductId: number,
  status: string,
  performedByUserId: string,
  performedByRole: string
) {
  try {
    // Only cascade if status is inactive or discontinued
    if (status !== 'inactive' && status !== 'discontinued') {
      return { updatedOrgCount: 0, updatedBranchCount: 0, affectedOrgs: [], affectedBranches: [] }
    }

    // Find all organization inventory items for this global product
    const orgItems = await db.select({
      id: organizationInventory.id,
      organizationId: organizationInventory.organizationId,
    })
    .from(organizationInventory)
    .where(
      and(
        eq(organizationInventory.globalProductId, globalProductId),
        isNull(organizationInventory.deletedAt)
      )
    )

    if (orgItems.length === 0) {
      return { updatedOrgCount: 0, updatedBranchCount: 0, affectedOrgs: [], affectedBranches: [] }
    }

    let totalBranchUpdates = 0
    const affectedBranches: number[] = []
    const affectedOrgs = orgItems.map(item => item.organizationId)

    // Update each organization inventory item and cascade to branches
    for (const orgItem of orgItems) {
      // First update the organization inventory item
      await db.update(organizationInventory)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(organizationInventory.id, orgItem.id))

      // Then cascade to branches
      const branchResult = await cascadeOrgStatusChange(
        orgItem.id,
        false, // isActive = false
        performedByUserId,
        performedByRole
      )
      totalBranchUpdates += branchResult.updatedCount
      affectedBranches.push(...branchResult.affectedBranches)
    }

    // Log the global cascade update
    await db.insert(auditLogs).values({
      userId: performedByUserId,
      action: "CASCADE_UPDATE",
      entity: "GlobalProduct",
      entityId: globalProductId.toString(),
      metadata: {
        triggeredBy: "global_product_status_change",
        globalProductId,
        status,
        updatedOrgCount: orgItems.length,
        updatedBranchCount: totalBranchUpdates,
        affectedOrgs,
        affectedBranches: [...new Set(affectedBranches)], // Remove duplicates
        performedByRole
      },
    })

    return {
      updatedOrgCount: orgItems.length,
      updatedBranchCount: totalBranchUpdates,
      affectedOrgs,
      affectedBranches: [...new Set(affectedBranches)]
    }
  } catch (error) {
    console.error("Error in cascadeGlobalProductStatusChange:", error)
    throw error
  }
}

/**
 * Get the effective product data for a branch inventory item
 * Returns organization overrides if they exist, otherwise global values
 */
export function getEffectiveProductData(
  globalProduct: {
    name: string
    description?: string | null
    imageUrl?: string | null
    basePrice: number
  },
  orgInventory?: {
    customName?: string | null
    customDescription?: string | null
    customImageUrl?: string | null
    customPrice?: number | null
  } | null
) {
  return {
    name: orgInventory?.customName || globalProduct.name,
    description: orgInventory?.customDescription || globalProduct.description,
    imageUrl: orgInventory?.customImageUrl || globalProduct.imageUrl,
    price: orgInventory?.customPrice || globalProduct.basePrice,
  }
}
