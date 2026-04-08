import { NextRequest, NextResponse } from "next/server"
import { generateAndSendOTP } from "@/lib/mfa"
import { withSuperAdmin } from "@/lib/db"
import { users } from "@/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { type = 'LOGIN' } = body

    const result = await withSuperAdmin(async (tx) => {
      const [user] = await tx
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.id, scope.userId), isNull(users.deletedAt)))
        .limit(1)

      if (!user) throw new Error("User not found")
      return await generateAndSendOTP(scope.userId, user.email, type)
    })

    if (result.success) {
      return NextResponse.json({
        message: result.message,
        cooldownUntil: result.cooldownUntil
      })
    } else {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send OTP" }, { status: 500 })
  }
}


