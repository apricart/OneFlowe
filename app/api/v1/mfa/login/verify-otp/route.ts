import { NextRequest, NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/db"
import { users, employeeCredentials } from "@/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { verifyOTP } from "@/lib/mfa"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { username, code, type = 'LOGIN' } = body

    if (!username || !code) return NextResponse.json({ error: "Username and code are required" }, { status: 400 })
    if (code.length !== 6) return NextResponse.json({ error: "Please enter a valid 6-digit OTP code" }, { status: 400 })

    const result = await withSuperAdmin(async (tx) => {
      let [user]: any[] = await tx.select({ id: users.id, email: users.email, mfaEnabled: users.mfaEnabled })
        .from(users).where(and(eq(users.username, username.toLowerCase()), isNull(users.deletedAt))).limit(1)

      if (!user) {
        const [emp] = await tx.select({ id: employeeCredentials.id, email: employeeCredentials.email, mfaEnabled: employeeCredentials.mfaEnabled })
          .from(employeeCredentials).where(eq(employeeCredentials.username, username.toLowerCase())).limit(1)
        if (emp) user = emp
      }

      if (!user) return { error: "User not found", status: 404 }
      if (!user.mfaEnabled) return { error: "MFA is not enabled for this user", status: 400 }

      const verifyResult = await verifyOTP(user.id, code, type)
      return { ...verifyResult, userId: user.id }
    })

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })

    if (result.success) {
      return NextResponse.json({ message: result.message, verified: true, userId: result.userId })
    } else {
      const remainingMsg = result.remainingAttempts !== undefined ? ` (${result.remainingAttempts} attempts remaining)` : ''
      return NextResponse.json({ error: result.message + remainingMsg }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 })
  }
}


