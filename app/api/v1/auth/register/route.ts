import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, roles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword } from "@/lib/password"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, role = "SUPER_ADMIN" } = body as { email: string; password: string; role?: string }

    if (!email || !password) {
      return NextResponse.json({ error: "Email & password required" }, { status: 400 })
    }

    const [roleRow] = await db.select().from(roles).where(eq(roles.name, role))
    if (!roleRow) return NextResponse.json({ error: "Invalid role" }, { status: 400 })

    const [exists] = await db.select().from(users).where(eq(users.email, email))
    if (exists) return NextResponse.json({ error: "User already exists" }, { status: 409 })

    const passwordHash = await hashPassword(password)
    await db.insert(users).values({ email, passwordHash, roleId: roleRow.id })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
