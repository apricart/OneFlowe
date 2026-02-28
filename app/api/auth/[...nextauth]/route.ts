import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { NextRequest } from "next/server"
import { checkRateLimit, rateLimitResponse, getClientIdentifier } from "@/lib/rate-limiter"

const handler = NextAuth(authOptions)

// GET requests pass through (session checks, CSRF token)
export { handler as GET }

// POST requests (login attempts) are rate-limited
export async function POST(req: NextRequest, context: any) {
    // Only rate-limit actual credential login attempts, not signOut or CSRF requests
    const url = new URL(req.url || "http://localhost")
    const isSignIn = url.pathname.endsWith('/callback/credentials') ||
        url.pathname.endsWith('/callback/employee-credentials')

    if (isSignIn) {
        // Rate limit login attempts: 15 per 15 minutes per IP
        const identifier = await getClientIdentifier()
        const { allowed, resetIn } = await checkRateLimit(identifier, "login")

        if (!allowed) {
            return rateLimitResponse(resetIn)
        }
    }

    return handler(req, context)
}
