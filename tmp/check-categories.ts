import { db } from "../lib/db"
import { globalProducts, categories } from "../db/schema"
import { eq, ilike } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

async function main() {
    const products = await db.select({
        id: globalProducts.id,
        name: globalProducts.name,
        categoryId: globalProducts.categoryId,
    }).from(globalProducts)
        .where(ilike(globalProducts.name, "%Tang%"))
        .limit(1)

    if (products.length > 0) {
        const p = products[0];
        console.log(`Product: ${p.name}, CategoryId: ${p.categoryId}`);

        const subCategories = alias(categories, "sub")
        const parentCategories = alias(categories, "parent")

        const catData = await db.select({
            subId: subCategories.id,
            subName: subCategories.name,
            subParentId: subCategories.parentId,
            parentName: parentCategories.name
        })
            .from(subCategories)
            .leftJoin(parentCategories, eq(subCategories.parentId, parentCategories.id))
            .where(eq(subCategories.id, p.categoryId!))

        console.log("Category Data:", JSON.stringify(catData, null, 2));
    } else {
        console.log("Product Tang not found");
    }
}

main().catch(console.error).finally(() => process.exit())
