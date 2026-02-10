import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { NextRequest } from "next/server"
import { checkRateLimit, rateLimitResponse, getClientIdentifier } from "@/lib/rate-limiter"

const handler = NextAuth(authOptions)

// GET requests pass through (session checks, CSRF token)
export { handler as GET }

// POST requests (login attempts) are rate-limited
export async function POST(req: NextRequest, context: any) {
    // Rate limit login attempts: 5 per 15 minutes per IP
    const identifier = await getClientIdentifier()
    const { allowed, resetIn } = await checkRateLimit(identifier, "login")

    if (!allowed) {
        return rateLimitResponse(resetIn)
    }

    return handler(req, context)
}
