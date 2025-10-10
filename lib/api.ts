import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import type { Role } from "@/lib/rbac"
import { requireRole } from "@/lib/rbac"

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as any, init)
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

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
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    requireRole(current.role, allowed)
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}


