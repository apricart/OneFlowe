import { db } from "@/lib/db"
import { roles } from "@/db/schema"
import { ok, requireApiRole } from "@/lib/api"
import { getCached, CACHE_TTL } from "@/lib/cache-utils"

export async function GET() {
  // Allow all authenticated users to view roles
  const err = await requireApiRole(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"])
  if (err) return err

  const data = await getCached(
    'cache:roles:all',
    () => db.select({ id: roles.id, name: roles.name }).from(roles),
    CACHE_TTL.STATIC
  )
  return ok({ data })
}
