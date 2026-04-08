import { db, withTenant, withSuperAdmin } from "@/lib/db"
import { suppliers } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE"]
    if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const params = await props.params
    const { id } = params
    const supplierId = Number(id)

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      const [item] = await tx.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)
      return item
    })

    if (!result) return NextResponse.json({ error: "Supplier not found or access denied" }, { status: 404 })

    return NextResponse.json({ item: result })
  } catch (err: any) {
    console.error("Supplier GET error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE"]
    if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const params = await props.params
    const { id } = params
    const supplierId = Number(id)

    const body = await req.json().catch(() => ({}))
    const patch: any = {}
    ;["name", "address", "contact", "email", "description"].forEach((k) => { 
      if (k in body) patch[k] = body[k] 
    })

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No update fields provided" }, { status: 400 })

    const runner = user.role === "SUPER_ADMIN" ? withSuperAdmin : (cb: any) => withTenant(user, cb)

    const result = await runner(async (tx: any) => {
      const [updated] = await tx
        .update(suppliers)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(suppliers.id, supplierId))
        .returning()
      return updated
    })

    if (!result) return NextResponse.json({ error: "Supplier not found or access denied" }, { status: 404 })

    return NextResponse.json({ item: result })
  } catch (err: any) {
    console.error("Supplier PATCH error:", err)
    return NextResponse.json({ error: err.message || "Failed to update supplier" }, { status: 400 })
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const params = await props.params
    const { id } = params
    const supplierId = Number(id)

    await withSuperAdmin(async (tx) => {
      await tx.delete(suppliers).where(eq(suppliers.id, supplierId))
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Supplier DELETE error:", err)
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 })
  }
}


