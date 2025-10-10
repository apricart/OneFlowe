import { getServerSession } from "next-auth"
import type { Role } from "./rbac"
import { db } from "@/lib/db"
import { sessions } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { authOptions } from "./auth-options"

const INACTIVITY_TIMEOUT_MIN = Number(process.env.INACTIVITY_TIMEOUT_MINUTES || 30)

export type CurrentUser = {
  id: string
  email: string
  role: Role
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return {
    id: (session.user as any).id,
    email: session.user.email || "",
    role: ((session.user as any).role || "BRANCH_ADMIN") as Role,
  }
}

export async function touchSession(userId: string) {
  await db.update(sessions).set({ lastActivityAt: new Date() }).where(and(eq(sessions.userId, userId)))
}

export async function isSessionInactive(lastActivity: Date) {
  const now = Date.now()
  const diffMin = (now - lastActivity.getTime()) / 60000
  return diffMin > INACTIVITY_TIMEOUT_MIN
}

// Convenience: create SUPER_ADMIN role and first user if not exists (optional bootstrap)
// Optionally implement bootstrap via a separate script using Drizzle directly
