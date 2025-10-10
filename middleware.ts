import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/lib/utils"
import { getToken } from "next-auth/jwt"

const protectedPrefixes = ["/dashboard", "/organizations", "/users", "/orders", "/inventory", "/budgets", "/reports", "/settings", "/branches"]

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
  // Enforce SUPER_ADMIN for admin sections
  const role = (token as any).role as string | undefined
  // Super Admin only routes
  if ((pathname.startsWith("/organizations") || pathname.startsWith("/users")) && role !== "SUPER_ADMIN") {
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
  ],
}
