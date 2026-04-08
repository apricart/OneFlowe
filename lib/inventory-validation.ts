import { db } from "@/lib/db"
import { organizationInventory, branchInventory, globalProducts, organizations, branches } from "@/db/schema"
import { eq, and, isNull } from "drizzle-orm"

/**
 * Validate that an organization exists and is active
 */
export async function validateOrganization(organizationId: number, tx?: any): Promise<boolean> {
  try {
    const dbInstance = tx || db
    const org = await dbInstance.select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    return org.length > 0
  } catch (error) {
    console.error("Error validating organization:", error)
    return false
  }
}

/**
 * Validate that a branch exists and belongs to the organization
 */
export async function validateBranch(branchId: number, organizationId: number, tx?: any): Promise<boolean> {
  try {
    const dbInstance = tx || db
    const branch = await dbInstance.select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.id, branchId),
          eq(branches.organizationId, organizationId)
        )
      )
      .limit(1)

    return branch.length > 0
  } catch (error) {
    console.error("Error validating branch:", error)
    return false
  }
}

/**
 * Validate that a global product exists and is active
 */
export async function validateGlobalProduct(globalProductId: number, tx?: any): Promise<boolean> {
  try {
    const dbInstance = tx || db
    const product = await dbInstance.select({ id: globalProducts.id })
      .from(globalProducts)
      .where(
        eq(globalProducts.id, globalProductId)
      )
      .limit(1)

    return product.length > 0
  } catch (error) {
    console.error("Error validating global product:", error)
    return false
  }
}

/**
 * Validate that an organization inventory item exists and belongs to the organization
 */
export async function validateOrganizationInventory(
  organizationInventoryId: number,
  organizationId: number,
  tx?: any
): Promise<boolean> {
  try {
    const dbInstance = tx || db
    const orgInventory = await dbInstance.select({ id: organizationInventory.id })
      .from(organizationInventory)
      .where(
        and(
          eq(organizationInventory.id, organizationInventoryId),
          eq(organizationInventory.organizationId, organizationId),
          isNull(organizationInventory.deletedAt)
        )
      )
      .limit(1)

    return orgInventory.length > 0
  } catch (error) {
    console.error("Error validating organization inventory:", error)
    return false
  }
}

/**
 * Validate that a branch inventory item exists and belongs to the branch
 */
export async function validateBranchInventory(
  branchInventoryId: number,
  branchId: number,
  organizationId: number,
  tx?: any
): Promise<boolean> {
  try {
    const dbInstance = tx || db
    const branchInv = await dbInstance.select({ id: branchInventory.id })
      .from(branchInventory)
      .where(
        and(
          eq(branchInventory.id, branchInventoryId),
          eq(branchInventory.branchId, branchId),
          eq(branchInventory.organizationId, organizationId),
          isNull(branchInventory.deletedAt)
        )
      )
      .limit(1)

    return branchInv.length > 0
  } catch (error) {
    console.error("Error validating branch inventory:", error)
    return false
  }
}

/**
 * Validate that a user has access to an organization
 */
export async function validateUserOrganizationAccess(
  userId: string,
  organizationId: number
): Promise<boolean> {
  try {
    // This would typically check user roles and organization membership
    // For now, we'll assume the session middleware handles this
    return true
  } catch (error) {
    console.error("Error validating user organization access:", error)
    return false
  }
}

/**
 * Validate that a user has access to a branch
 */
export async function validateUserBranchAccess(
  userId: string,
  branchId: number,
  organizationId: number
): Promise<boolean> {
  try {
    // This would typically check user roles and branch membership
    // For now, we'll assume the session middleware handles this
    return true
  } catch (error) {
    console.error("Error validating user branch access:", error)
    return false
  }
}

/**
 * Check if a product assignment would create a duplicate
 */
export async function checkDuplicateOrganizationAssignment(
  organizationId: number,
  globalProductId: number,
  tx?: any
): Promise<boolean> {
  try {
    const dbInstance = tx || db
    const existing = await dbInstance.select({ id: organizationInventory.id })
      .from(organizationInventory)
      .where(
        and(
          eq(organizationInventory.organizationId, organizationId),
          eq(organizationInventory.globalProductId, globalProductId),
          isNull(organizationInventory.deletedAt)
        )
      )
      .limit(1)

    return existing.length > 0
  } catch (error) {
    console.error("Error checking duplicate organization assignment:", error)
    return false
  }
}

/**
 * Check if a branch assignment would create a duplicate
 */
export async function checkDuplicateBranchAssignment(
  branchId: number,
  organizationInventoryId: number,
  tx?: any
): Promise<boolean> {
  try {
    const dbInstance = tx || db
    const existing = await dbInstance.select({ id: branchInventory.id })
      .from(branchInventory)
      .where(
        and(
          eq(branchInventory.branchId, branchId),
          eq(branchInventory.organizationInventoryId, organizationInventoryId),
          isNull(branchInventory.deletedAt)
        )
      )
      .limit(1)

    return existing.length > 0
  } catch (error) {
    console.error("Error checking duplicate branch assignment:", error)
    return false
  }
}

/**
 * Validate assignment data before creation
 */
export async function validateAssignmentData(data: {
  organizationId?: number
  branchId?: number
  globalProductId?: number
  organizationInventoryId?: number
  userId?: string
}, tx?: any): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  try {
    // Validate organization
    if (data.organizationId) {
      const orgValid = await validateOrganization(data.organizationId, tx)
      if (!orgValid) {
        errors.push("Invalid organization ID")
      }
    }

    // Validate branch
    if (data.branchId && data.organizationId) {
      const branchValid = await validateBranch(data.branchId, data.organizationId, tx)
      if (!branchValid) {
        errors.push("Invalid branch ID or branch does not belong to organization")
      }
    }

    // Validate global product
    if (data.globalProductId) {
      const productValid = await validateGlobalProduct(data.globalProductId, tx)
      if (!productValid) {
        errors.push("Invalid global product ID or product is not active")
      }
    }

    // Validate organization inventory
    if (data.organizationInventoryId && data.organizationId) {
      const orgInvValid = await validateOrganizationInventory(data.organizationInventoryId, data.organizationId, tx)
      if (!orgInvValid) {
        errors.push("Invalid organization inventory ID or access denied")
      }
    }

    // Check for duplicates
    if (data.organizationId && data.globalProductId) {
      const isDuplicate = await checkDuplicateOrganizationAssignment(data.organizationId, data.globalProductId, tx)
      if (isDuplicate) {
        errors.push("Product is already assigned to this organization")
      }
    }

    if (data.branchId && data.organizationInventoryId) {
      const isDuplicate = await checkDuplicateBranchAssignment(data.branchId, data.organizationInventoryId, tx)
      if (isDuplicate) {
        errors.push("Product is already assigned to this branch")
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  } catch (error) {
    console.error("Error validating assignment data:", error)
    return {
      valid: false,
      errors: ["Validation error occurred"]
    }
  }
}

