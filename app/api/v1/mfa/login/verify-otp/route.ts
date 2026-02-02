import { NextRequest } from "next/server"
import { ok, error, readJson } from "@/lib/api"
import { verifyOTP } from "@/lib/mfa"

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<any>(req)
    if (!body) return error("Invalid request body", 400)

    const { email, code, type = 'LOGIN' } = body

    if (!email || !code) {
      return error("Email and code are required", 400)
    }

    if (code.length !== 6) {
      return error("Please enter a valid 6-digit OTP code", 400)
    }

    // Get user by email
    const { db } = await import("@/lib/db")
    const { users } = await import("@/db/schema")
    const { eq } = await import("drizzle-orm")

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        mfaEnabled: users.mfaEnabled
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (!user) {
      return error("User not found", 404)
    }

    if (!user.mfaEnabled) {
      return error("MFA is not enabled for this user", 400)
    }

    const result = await verifyOTP(user.id, code, type)

    if (result.success) {
      return ok({
        message: result.message,
        verified: true,
        userId: user.id
      })
    } else {
      return error(result.message + (result.remainingAttempts !== undefined ? ` (${result.remainingAttempts} attempts remaining)` : ''), 400)
    }

  } catch (err) {
    console.error("Error verifying OTP:", err)
    return error("Failed to verify OTP", 500)
  }
}
