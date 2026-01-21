export type Role = "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN" | "ORDER_PORTAL" | "EMPLOYEE"

export function requireRole(current: Role, allowed: Role[]) {
  if (!allowed.includes(current)) {
    const err = new Error("Forbidden") as any
    err.status = 403
    throw err
  }
}
