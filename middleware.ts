import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/lib/utils"
import { getToken } from "next-auth/jwt"

const protectedPrefixes = ["/dashboard", "/organizations", "/users", "/orders", "/inventory", "/budgets", "/reports", "/settings", "/branches", "/shop"]

/**
 * Inject bank-grade security headers into every response
 */
function withSecurityHeaders(response: NextResponse, pathname: string = ""): NextResponse {
  // HSTS — force HTTPS for 1 year + subdomains
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  // Clickjacking protection — prevent framing entirely
  response.headers.set("X-Frame-Options", "DENY")
  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")
  // Modern XSS protection (rely on CSP, disable legacy filter)
  response.headers.set("X-XSS-Protection", "0")
  // Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  // Disable dangerous browser features
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'"
  )
  // Remove server identification
  response.headers.delete("X-Powered-By")

  // Browsing Cache (Browser Caching)
  if (pathname.startsWith("/api/v1/")) {
    if (pathname.includes("/roles") || pathname.includes("/categories") || pathname.includes("/settings")) {
      response.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=300")
    } else if (pathname.includes("/organizations") || pathname.includes("/branches") || pathname.includes("/groups")) {
      response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30")
    } else if (pathname.includes("/branch/inventory")) {
      response.headers.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=10")
    } else {
      // Default for other APIs: no sensitive caching by default
      response.headers.set("Cache-Control", "no-store, max-age=0")
    }
  }

  return response
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const response = NextResponse.next()

  const needsAuth = protectedPrefixes.some((p) => pathname.startsWith(p))
  if (!needsAuth) return withSecurityHeaders(response, pathname)

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    logger("middleware", { reason: "no_session", path: pathname })
    const url = new URL("/login", req.url)
    const redirectRes = NextResponse.redirect(url)
    return withSecurityHeaders(redirectRes, pathname)
  }

  const role = (token as any).role as string | undefined

  // Role-based routing enforcement
  // 1. ORDER_PORTAL users can ONLY access /shop
  if (role === "ORDER_PORTAL" && !pathname.startsWith("/shop")) {
    const url = new URL("/shop", req.url)
    const redirectRes = NextResponse.redirect(url)
    return withSecurityHeaders(redirectRes, pathname)
  }

  // 2. Admin users cannot access /shop — strict separation
  if (role && ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"].includes(role) && pathname.startsWith("/shop")) {
    const url = new URL("/dashboard", req.url)
    const redirectRes = NextResponse.redirect(url)
    return withSecurityHeaders(redirectRes, pathname)
  }

  // Enforce SUPER_ADMIN for admin sections
  if (pathname.startsWith("/organizations") && role !== "SUPER_ADMIN") {
    logger("middleware", { reason: "insufficient_role", path: pathname, role })
    const url = new URL("/login", req.url)
    const redirectRes = NextResponse.redirect(url)
    return withSecurityHeaders(redirectRes, pathname)
  }
  // Users route - accessible by SUPER_ADMIN and HEAD_OFFICE
  if (pathname.startsWith("/users") && !["SUPER_ADMIN", "HEAD_OFFICE"].includes(role || "")) {
    logger("middleware", { reason: "insufficient_role", path: pathname, role })
    const url = new URL("/login", req.url)
    const redirectRes = NextResponse.redirect(url)
    return withSecurityHeaders(redirectRes, pathname)
  }
  // Head Office only routes  
  if (pathname.startsWith("/branches") && role !== "HEAD_OFFICE") {
    logger("middleware", { reason: "insufficient_role", path: pathname, role })
    const url = new URL("/login", req.url)
    const redirectRes = NextResponse.redirect(url)
    return withSecurityHeaders(redirectRes, pathname)
  }

  return withSecurityHeaders(response, pathname)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes that need custom auth handling)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static file extensions (manifest.json, images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|ico)$).*)",
    "/dashboard",
    "/dashboard/:path*",
    "/organizations/:path*",
    "/users/:path*",
    "/branches/:path*",
    "/orders/:path*",
    "/inventory/:path*",
    "/budgets/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/shop",
    "/shop/:path*",
  ],
}
