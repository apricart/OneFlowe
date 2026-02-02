import { NextRequest } from "next/server"
import { ok, error, requireApiRole, readJson } from "@/lib/api"
import { getRequestScope } from "@/lib/auth"
import { generateAndSendOTP } from "@/lib/mfa"

export async function POST(req: NextRequest) {
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err

  try {
    const body = await readJson<any>(req)
    if (!body) return error("Invalid request body", 400)

    const { type = 'LOGIN' } = body
    const scope = await getRequestScope()

    if (!scope?.userId) {
      return error("User not authenticated", 401)
    }

    // Get user email
    const { db } = await import("@/lib/db")
    const { users } = await import("@/db/schema")
    const { eq } = await import("drizzle-orm")

    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, scope.userId))
      .limit(1)

    if (!user) {
      return error("User not found", 404)
    }

    const result = await generateAndSendOTP(scope.userId, user.email, type)

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
