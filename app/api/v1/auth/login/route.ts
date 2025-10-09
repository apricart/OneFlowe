import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, roles, sessions } from "@/db/schema"
import { eq } from "drizzle-orm"
import { verifyPassword } from "@/lib/password"
import { signAccessToken, signRefreshToken } from "@/lib/jwt"
import jwt from "jsonwebtoken"
import crypto from "crypto"

function setAuthCookies(res: NextResponse, access: string, refresh: string) {
  const secure = true
  res.cookies.set("access_token", access, { httpOnly: true, secure, sameSite: "strict", path: "/" })
  res.cookies.set("refresh_token", refresh, { httpOnly: true, secure, sameSite: "strict", path: "/" })
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: "Email & password required" }, { status: 400 })

    const [u] = await db
      .select({ id: users.id, email: users.email, hash: users.passwordHash, roleId: users.roleId })
      .from(users)
      .where(eq(users.email, email))
    if (!u) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })

    const ok = await verifyPassword(password, u.hash)
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })

    const [r] = await db.select().from(roles).where(eq(roles.id, u.roleId))
    const roleName = r?.name || "BRANCH_ADMIN"

    const access = signAccessToken({ sub: u.id, role: roleName })
    const refresh = signRefreshToken({ sub: u.id, role: roleName })

    const refreshHash = crypto.createHash("sha256").update(refresh).digest("hex")
    const now = new Date()
    const refreshDecoded = jwt.decode(refresh) as jwt.JwtPayload
    const expiresAt = new Date((refreshDecoded?.exp || 0) * 1000)

    await db.insert(sessions).values({
      userId: u.id,
      refreshTokenHash: refreshHash,
      lastActivityAt: now,
      expiresAt,
    })

    const res = NextResponse.json({ success: true, role: roleName })
    setAuthCookies(res, access, refresh)
    return res
  } catch (e: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
