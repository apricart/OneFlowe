import { NextRequest } from "next/server"
import { ok, error, requireApiRole } from "@/lib/api"
import { getRequestScope } from "@/lib/auth"
import { isMFAEnabled } from "@/lib/mfa"

export async function GET(req: NextRequest) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err

  try {
    const scope = await getRequestScope()
    if (!scope?.userId) {
      return error("User not authenticated", 401)
    }

    const enabled = await isMFAEnabled(scope.userId)
    
    return ok({ 
      mfaEnabled: enabled,
      message: enabled ? "MFA is enabled" : "MFA is disabled"
    })

  } catch (error) {
    console.error("Error checking MFA status:", error)
    return error("Failed to check MFA status", 500)
  }
}
