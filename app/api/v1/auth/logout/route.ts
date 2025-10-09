import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { sessions } from "@/db/schema"
import { eq } from "drizzle-orm"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const refresh = cookieStore.get("refresh_token")?.value
  if (refresh) {
    const refreshHash = crypto.createHash("sha256").update(refresh).digest("hex")
    await db.delete(sessions).where(eq(sessions.refreshTokenHash, refreshHash))
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set("access_token", "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 })
  res.cookies.set("refresh_token", "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 })
  return res
}
