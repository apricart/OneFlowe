import { NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders } from "@/db/schema"
import { asc } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET() {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const firstOrder = await tx.select({ createdAt: orders.createdAt })
        .from(orders).orderBy(asc(orders.createdAt)).limit(1)

      if (firstOrder.length === 0) return { earliestDate: new Date().toISOString() }
      return { earliestDate: firstOrder[0].createdAt }
    }
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
