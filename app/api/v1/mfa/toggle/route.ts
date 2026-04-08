import { NextRequest, NextResponse } from "next/server"
import { enableMFA, disableMFA } from "@/lib/mfa"
import { getRequestScope } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { action } = body

    if (action === 'enable') {
      const result = await enableMFA(scope.userId)
      return NextResponse.json({
        message: result.message,
        mfaEnabled: true
      })
    } else if (action === 'disable') {
      const result = await disableMFA(scope.userId)
      return NextResponse.json({
        message: result.message,
        mfaEnabled: false
      })
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'enable' or 'disable'" }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: "Failed to toggle MFA" }, { status: 500 })
  }
}


