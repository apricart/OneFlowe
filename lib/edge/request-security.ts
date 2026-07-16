const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "authjs.session-token",
  "__Secure-authjs.session-token",
]

export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  return SESSION_COOKIE_NAMES.some((name) => cookieHeader.includes(`${name}=`))
}

export function isCookieAuthenticatedMutationAllowed(input: {
  method: string
  requestUrl: string
  origin: string | null
  secFetchSite: string | null
  cookieHeader: string | null
}): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true
  if (!hasSessionCookie(input.cookieHeader)) return true

  if (input.origin) {
    try {
      return new URL(input.origin).origin === new URL(input.requestUrl).origin
    } catch {
      return false
    }
  }

  return input.secFetchSite === "same-origin"
}

export function requestBodyLimitForPath(pathname: string): number {
  if (pathname === "/api/v1/upload/image") return 5 * 1024 * 1024
  if (pathname.includes("/import")) return 3 * 1024 * 1024
  if (pathname === "/api/v1/admin/global-inventory") return 7 * 1024 * 1024
  if (pathname.startsWith("/api/v1/inventory/global-products/")) return 7 * 1024 * 1024
  return 1024 * 1024
}

export function isKnownBodyTooLarge(contentLength: string | null, maximumBytes: number): boolean {
  if (!contentLength || !/^\d+$/.test(contentLength)) return false
  const parsed = Number(contentLength)
  return Number.isSafeInteger(parsed) && parsed > maximumBytes
}
