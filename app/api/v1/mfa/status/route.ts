import { NextRequest, NextResponse } from "next/server"
import { isMFAEnabled } from "@/lib/mfa"
import { getRequestScope } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const enabled = await isMFAEnabled(scope.userId)

    return NextResponse.json({
      mfaEnabled: enabled,
      message: enabled ? "MFA is enabled" : "MFA is disabled"
    })
  } catch (err) {
    return NextResponse.json({ error: "Failed to check MFA status" }, { status: 500 })
  }
}

