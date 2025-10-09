import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyRefreshToken, signAccessToken } from "@/lib/jwt"
import { db } from "@/lib/db"
import { sessions } from "@/db/schema"
import { and, eq, gt } from "drizzle-orm"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const refresh = cookieStore.get("refresh_token")?.value
    if (!refresh) return NextResponse.json({ error: "No refresh token" }, { status: 401 })

    const payload = verifyRefreshToken(refresh)
    const refreshHash = crypto.createHash("sha256").update(refresh).digest("hex")

    const [sess] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, payload.sub),
          eq(sessions.refreshTokenHash, refreshHash),
          gt(sessions.expiresAt, new Date()),
        ),
      )
    if (!sess) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    // Inactivity enforcement
    const last = sess.lastActivityAt ?? new Date(0)
    const diffMin = (Date.now() - last.getTime()) / 60000
    const INACTIVITY_TIMEOUT_MIN = Number(process.env.INACTIVITY_TIMEOUT_MINUTES || 30)
    if (diffMin > INACTIVITY_TIMEOUT_MIN) {
      return NextResponse.json({ error: "Session expired due to inactivity" }, { status: 401 })
    }

    // Update lastActivityAt on successful refresh
    await db
      .update(sessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(sessions.id, (sess as any).id))

    const access = signAccessToken({ sub: payload.sub!, role: (payload as any).role })

    const res = NextResponse.json({ success: true })
    res.cookies.set("access_token", access, { httpOnly: true, secure: true, sameSite: "strict", path: "/" })
    return res
  } catch {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 })
  }
}
