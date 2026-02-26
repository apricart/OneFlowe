
import { db } from "./lib/db"
import { globalProducts, organizationInventory, organizations } from "./db/schema"
import { eq, ilike, and } from "drizzle-orm"

async function main() {
    console.log("Searching for 'ABC Juice' in globalProducts...")
    const products = await db.select().from(globalProducts).where(ilike(globalProducts.name, "%ABC Juice%"))
    console.log("Global Products found:", JSON.stringify(products, null, 2))

    if (products.length > 0) {
        const productId = products[0].id
        console.log(`\nSearching for assignments of product ID ${productId} in organizationInventory...`)
        const assignments = await db.select({
            id: organizationInventory.id,
            orgId: organizationInventory.organizationId,
            orgName: organizations.name,
            isActive: organizationInventory.isActive,
            deletedAt: organizationInventory.deletedAt,
        })
            .from(organizationInventory)
            .leftJoin(organizations, eq(organizationInventory.organizationId, organizations.id))
            .where(eq(organizationInventory.globalProductId, productId))

        console.log("Assignments found:", JSON.stringify(assignments, null, 2))
    }
}

main().catch(console.error).finally(() => process.exit())
