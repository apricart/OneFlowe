import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { inventory } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope || !["SUPER_ADMIN", "HEAD_OFFICE"].includes(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get("branchId")
    
    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const where: any[] = []
      if (branchId) where.push(eq(inventory.branchId, Number(branchId)))

      return tx.select()
        .from(inventory)
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(inventory.updatedAt))
    }

    return NextResponse.json({ items: result })
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope || !["SUPER_ADMIN", "HEAD_OFFICE"].includes(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    if (!body?.organizationId || !body?.branchId || !Array.isArray(body?.items) || !body?.type) {
      return NextResponse.json({ error: "organizationId, branchId, type, items are required" }, { status: 400 })
    }

    return await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      // Inventory adjustments placeholder
      return NextResponse.json({ error: "Not implemented: inventory transaction write path pending SKU mapping" }, { status: 501 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}


