import { db } from "@/lib/db"
import { categories } from "@/db/schema"

async function seedCategories() {
  try {
    console.log("Seeding categories...")
    
    // Insert sample categories
    const sampleCategories = [
      { name: "Dairy Products", parentId: null },
      { name: "Beverages", parentId: null },
      { name: "Snacks", parentId: null },
      { name: "Household Items", parentId: null },
    ]

    const insertedCategories = await db.insert(categories).values(sampleCategories).returning()
    console.log("Inserted categories:", insertedCategories)

    // Insert subcategories
    const dairyCategory = insertedCategories.find(c => c.name === "Dairy Products")
    const beverageCategory = insertedCategories.find(c => c.name === "Beverages")
    
    if (dairyCategory) {
      const dairySubCategories = [
        { name: "Milk", parentId: dairyCategory.id },
        { name: "Cheese", parentId: dairyCategory.id },
        { name: "Yogurt", parentId: dairyCategory.id },
      ]
      
      await db.insert(categories).values(dairySubCategories)
      console.log("Inserted dairy subcategories")
    }

    if (beverageCategory) {
      const beverageSubCategories = [
        { name: "Soft Drinks", parentId: beverageCategory.id },
        { name: "Juices", parentId: beverageCategory.id },
        { name: "Energy Drinks", parentId: beverageCategory.id },
      ]
      
      await db.insert(categories).values(beverageSubCategories)
      console.log("Inserted beverage subcategories")
    }

    console.log("Categories seeded successfully!")
  } catch (error) {
    console.error("Error seeding categories:", error)
  }
}

seedCategories()
