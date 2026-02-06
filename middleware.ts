import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/lib/utils"
import { getToken } from "next-auth/jwt"

const protectedPrefixes = ["/dashboard", "/organizations", "/users", "/orders", "/inventory", "/budgets", "/reports", "/settings", "/branches", "/shop"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const needsAuth = protectedPrefixes.some((p) => pathname.startsWith(p))
  if (!needsAuth) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    logger("middleware", { reason: "no_session", path: pathname })
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }

  const role = (token as any).role as string | undefined

  // Role-based routing enforcement
  // 1. ORDER_PORTAL users can ONLY access /shop
  if (role === "ORDER_PORTAL" && !pathname.startsWith("/shop")) {
    const url = new URL("/shop", req.url)
    return NextResponse.redirect(url)
  }

  // 2. Admin users (SUPER_ADMIN, HEAD_OFFICE, BRANCH_ADMIN) cannot access /shop (except maybe for debugging, but strict separation requested)
  if (role && ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"].includes(role) && pathname.startsWith("/shop")) {
    // If Admin tries to access shop, block them or redirect to dashboard
    // User requested "without credential you cannot access it", implying they should not see it with Admin creds.
    // Redirecting to dashboard effectively blocks access.
    const url = new URL("/dashboard", req.url)
    return NextResponse.redirect(url)
  }

  // 3. Removed redundant logic that caused potential loops

  // Enforce SUPER_ADMIN for admin sections
  // Super Admin only routes
  if (pathname.startsWith("/organizations") && role !== "SUPER_ADMIN") {
    logger("middleware", { reason: "insufficient_role", path: pathname, role })
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }
  // Users route - accessible by SUPER_ADMIN and HEAD_OFFICE
  if (pathname.startsWith("/users") && !["SUPER_ADMIN", "HEAD_OFFICE"].includes(role || "")) {
    logger("middleware", { reason: "insufficient_role", path: pathname, role })
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }
  // Head Office only routes  
  if (pathname.startsWith("/branches") && role !== "HEAD_OFFICE") {
    logger("middleware", { reason: "insufficient_role", path: pathname, role })
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
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
