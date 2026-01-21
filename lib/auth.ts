import { getServerSession } from "next-auth"
import type { Role } from "./rbac"
import { db } from "@/lib/db"
import { sessions, users } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { authOptions } from "./auth-options"

const INACTIVITY_TIMEOUT_MIN = Number(process.env.INACTIVITY_TIMEOUT_MINUTES || 30)

export type CurrentUser = {
  id: string
  email: string
  role: Role
  organizationId: number | null
  branchId: number | null
}

import { cookies } from 'next/headers'

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return {
    id: session.user.id,
    email: session.user.email || "",
    role: session.user.role || "BRANCH_ADMIN",
    organizationId: session.user.organizationId ?? null,
    branchId: session.user.branchId ?? null,
  }
}


export type RequestScope = {
  role: Role
  userId: string
  organizationId: number | null
  branchId: number | null
}

export async function getRequestScope(): Promise<RequestScope | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const userId = session.user.id
  const role = session.user.role || "BRANCH_ADMIN"
  const organizationId = session.user.organizationId
  const branchId = session.user.branchId

  // Super Admin can see everything; avoid extra DB call if organizationId is already in session
  if (role === "SUPER_ADMIN") {
    return { role, userId, organizationId, branchId }
  }

  // If ids are already in session, return them
  if (organizationId !== undefined || branchId !== undefined) {
    return {
      role,
      userId,
      organizationId: organizationId ?? null,
      branchId: branchId ?? null
    }
  }

  // Fallback to DB if for some reason they are missing from session
  const [row] = await db
    .select({ organizationId: users.organizationId, branchId: users.branchId })
    .from(users)
    .where(eq(users.id, userId))

  return {
    role,
    userId,
    organizationId: row?.organizationId ?? null,
    branchId: row?.branchId ?? null,
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
