import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { sessions, users, roles } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { verifyAccessToken } from "./jwt"
import type { Role } from "./rbac"
import { hashPassword } from "./password"

const INACTIVITY_TIMEOUT_MIN = Number(process.env.INACTIVITY_TIMEOUT_MINUTES || 30)

export type CurrentUser = {
  id: string
  email: string
  role: Role
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()
  const access = cookieStore.get("access_token")?.value
  if (!access) return null
  try {
    const payload = verifyAccessToken(access)
    return { id: payload.sub, email: "", role: payload.role as Role }
  } catch {
    return null
  }
}

export async function touchSession(userId: string) {
  // update last activity for active session(s)
  await db
    .update(sessions)
    .set({ lastActivityAt: new Date() })
    .where(and(eq(sessions.userId, userId)))
}

export async function isSessionInactive(lastActivity: Date) {
  const now = Date.now()
  const diffMin = (now - lastActivity.getTime()) / 60000
  return diffMin > INACTIVITY_TIMEOUT_MIN
}

// Convenience: create SUPER_ADMIN role and first user if not exists (optional bootstrap)
export async function ensureSuperAdminBootstrap(email: string, password: string) {
  // idempotent bootstrap
  const [superRole] = await db.select().from(roles).where(eq(roles.name, "SUPER_ADMIN"))
  let roleId = superRole?.id
  if (!roleId) {
    const inserted = await db
      .insert(roles)
      .values({ name: "SUPER_ADMIN", description: "Global administrator", permissions: {} })
      .returning()
    roleId = inserted[0].id
  }
  const [existing] = await db.select().from(users).where(eq(users.email, email))
  if (!existing) {
    const passwordHash = await hashPassword(password)
    await db.insert(users).values({ email, passwordHash, roleId })
  }
}
