import { NextResponse, type NextRequest } from "next/server"
import { verifyAccessToken } from "@/lib/jwt"

const protectedPrefixes = ["/super-admin"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const needsAuth = protectedPrefixes.some((p) => pathname.startsWith(p))
  if (!needsAuth) return NextResponse.next()

  const access = req.cookies.get("access_token")?.value
  if (!access) {
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }
  try {
    verifyAccessToken(access)
    return NextResponse.next()
  } catch {
    const url = new URL("/login", req.url)
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ["/super-admin/:path*"],
}
