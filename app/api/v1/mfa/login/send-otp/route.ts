import { NextRequest } from "next/server"
import { ok, error, readJson } from "@/lib/api"
import { generateAndSendOTP } from "@/lib/mfa"

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<any>(req)
    console.log("Send OTP API - Request body:", body)
    
    if (!body) return error("Invalid request body", 400)

    const { email, type = 'LOGIN' } = body
    
    if (!email) {
      console.log("Send OTP API - Missing email")
      return error("Email is required", 400)
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
      console.log("Send OTP API - User not found for email:", email)
      return error("User not found", 404)
    }

    if (!user.mfaEnabled) {
      console.log("Send OTP API - MFA not enabled for user:", user.id)
      return error("MFA is not enabled for this user", 400)
    }

    console.log("Send OTP API - Generating OTP for user:", user.id, "email:", user.email)
    const result = await generateAndSendOTP(user.id, user.email, type)
    console.log("Send OTP API - Result:", result)
    
    if (result.success) {
      return ok({ 
        message: result.message,
        cooldownUntil: result.cooldownUntil 
      })
    } else {
      return error(result.message, 400)
    }

  } catch (err) {
    console.error("Error sending OTP:", err)
    return error("Failed to send OTP", 500)
  }
}
