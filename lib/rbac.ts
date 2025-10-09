export type Role = "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN"

export function requireRole(current: Role, allowed: Role[]) {
  if (!allowed.includes(current)) {
    const err: any = new Error("Forbidden")
    err.status = 403
    throw err
  }
}
