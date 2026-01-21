import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import type { Role } from "@/lib/rbac"
import { requireRole } from "@/lib/rbac"

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as any, init)
}

export function okCached<T>(data: T, seconds = 30) {
  return NextResponse.json(data as any, {
    headers: {
      "Cache-Control": `public, max-age=${seconds}, stale-while-revalidate=${seconds * 10}`,
    },
  })
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// Alias for error function
export const err = error

export async function readJson<T = any>(req: Request): Promise<T | null> {
  try {
    const body = await req.json()
    return body as T
  } catch {
    return null
  }
}

export async function requireApiRole(allowed: Role[]) {
  const current = await getCurrentUser()
  if (!current) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  try {
    requireRole(current.role, allowed)
  } catch {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { user: current }
}



