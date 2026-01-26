import { db } from "../lib/db"
import { branchInventory, organizationInventory, globalProducts, categories } from "../db/schema"
import { and, eq, or, isNull, sql, desc } from "drizzle-orm"

async function inspectSql() {
    try {
        const orgIdNum = 1
        const branchId = 1
        const search = ""
        const visibility = "visible"

        const conditions = [
            eq(organizationInventory.organizationId, orgIdNum),
            isNull(organizationInventory.deletedAt),
        ]

        if (visibility === "visible") {
            conditions.push(
                or(
                    eq(branchInventory.isVisible, true),
                    isNull(branchInventory.id)
                )
            )
        }

        const query = db.select({
            id: sql<number>`COALESCE(${branchInventory.id}, ${organizationInventory.id})`,
        })
            .from(organizationInventory)
            .innerJoin(globalProducts, eq(organizationInventory.globalProductId, globalProducts.id))
            .leftJoin(
                branchInventory,
                and(
                    eq(branchInventory.organizationInventoryId, organizationInventory.id),
                    branchId ? eq(branchInventory.branchId, branchId) : eq(sql`1`, 0),
                    isNull(branchInventory.deletedAt),
                )
            )
            .where(and(...conditions))
            .toSQL()

        console.log("SQL:", query.sql)
        console.log("Params:", query.params)
        process.exit(0)
    } catch (e: any) {
        console.error("Error:", e.message)
        process.exit(1)
    }
}

inspectSql()
