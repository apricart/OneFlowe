import { NextRequest, NextResponse } from "next/server"
import { verifyOTP } from "@/lib/mfa"
import { getRequestScope } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { code, type = 'LOGIN' } = body

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "Please enter a valid 6-digit OTP code" }, { status: 400 })
    }

    const result = await verifyOTP(scope.userId, code, type)

    if (result.success) {
      return NextResponse.json({
        message: result.message,
        verified: true
      })
    } else {
      const remainingMsg = result.remainingAttempts !== undefined ? ` (${result.remainingAttempts} attempts remaining)` : ''
      return NextResponse.json({ error: result.message + remainingMsg }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 })
  }
}


