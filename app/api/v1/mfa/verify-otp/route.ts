import { NextRequest } from "next/server"
import { ok, error, requireApiRole, readJson } from "@/lib/api"
import { getRequestScope } from "@/lib/auth"
import { verifyOTP } from "@/lib/mfa"

export async function POST(req: NextRequest) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err

  try {
    const body = await readJson<any>(req)
    if (!body) return error("Invalid request body", 400)

    const { code, type = 'LOGIN' } = body
    
    if (!code || code.length !== 6) {
      return error("Please enter a valid 6-digit OTP code", 400)
    }

    const scope = await getRequestScope()
    if (!scope?.userId) {
      return error("User not authenticated", 401)
    }

    const result = await verifyOTP(scope.userId, code, type)
    
    if (result.success) {
      return ok({ 
        message: result.message,
        verified: true
      })
    } else {
      return error(result.message, 400, {
        remainingAttempts: result.remainingAttempts,
        cooldownUntil: result.cooldownUntil
      })
    }

  } catch (error) {
    console.error("Error verifying OTP:", error)
    return error("Failed to verify OTP", 500)
  }
}
