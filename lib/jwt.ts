import jwt from "jsonwebtoken"

const ACCESS_TTL_MIN = Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15)
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7)

export type JwtPayload = {
  sub: string
  role: string
}

export function signAccessToken(payload: JwtPayload) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is required")
  return jwt.sign(payload, secret, { expiresIn: `${ACCESS_TTL_MIN}m` })
}

export function signRefreshToken(payload: JwtPayload) {
  const secret = process.env.REFRESH_TOKEN_SECRET
  if (!secret) throw new Error("REFRESH_TOKEN_SECRET is required")
  return jwt.sign(payload, secret, { expiresIn: `${REFRESH_TTL_DAYS}d` })
}

export function verifyAccessToken(token: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is required")
  return jwt.verify(token, secret) as JwtPayload & jwt.JwtPayload
}

export function verifyRefreshToken(token: string) {
  const secret = process.env.REFRESH_TOKEN_SECRET
  if (!secret) throw new Error("REFRESH_TOKEN_SECRET is required")
  return jwt.verify(token, secret) as JwtPayload & jwt.JwtPayload
}
