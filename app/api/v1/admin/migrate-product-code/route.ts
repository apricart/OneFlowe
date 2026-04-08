import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { withSuperAdmin } from "@/lib/db"
import { sql } from "drizzle-orm"

// Temporary migration endpoint - DELETE THIS FILE AFTER RUNNING
export async function POST() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const user = session.user as any
        if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const result = await withSuperAdmin(async (tx: any) => {
            // Create partial unique index that only applies to non-deleted products
            await tx.execute(sql`
                CREATE UNIQUE INDEX IF NOT EXISTS global_products_code_unique_active 
                ON global_products (product_code) 
                WHERE deleted_at IS NULL
            `)
            return { message: "Migration completed successfully - partial unique index created" }
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error("Migration error:", error)
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
    }
}

