import { NextRequest, NextResponse } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { suppliers } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope || !["SUPER_ADMIN", "HEAD_OFFICE"].includes(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    let organizationId = searchParams.get("organizationId")
    if (scope.role === "HEAD_OFFICE") organizationId = String(scope.organizationId)

    const branchId = searchParams.get("branchId")

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const where = [
        organizationId ? eq(suppliers.organizationId, Number(organizationId)) : undefined,
        branchId ? eq(suppliers.branchId, Number(branchId)) : undefined,
      ].filter(Boolean) as any

      return tx
        .select()
        .from(suppliers)
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(suppliers.createdAt))
    }

    return NextResponse.json({ items: result })
  } catch (e: any) {
    if (e?.code === '42P01') return NextResponse.json({ items: [] })
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope || !["SUPER_ADMIN", "HEAD_OFFICE"].includes(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    if (!body?.organizationId || !body?.branchId || !body?.name) {
      return NextResponse.json({ error: "organizationId, branchId, name are required" }, { status: 400 })
    }

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      const [item] = await tx
        .insert(suppliers)
        .values({
          organizationId: Number(body.organizationId),
          branchId: Number(body.branchId),
          name: String(body.name),
          address: body.address ? String(body.address) : null,
          contact: body.contact ? String(body.contact) : null,
          email: body.email ? String(body.email) : null,
          description: body.description ? String(body.description) : null,
        })
        .returning()
      return item
    }

    return NextResponse.json({ item: result }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

