import { db } from "@/lib/db"
import { roles } from "@/db/schema"
import { okCached as ok, requireApiRole } from "@/lib/api"

export async function GET() {
  const err = await requireApiRole(["SUPER_ADMIN"])
  if (err) return err
  const data = await db.select({ id: roles.id, name: roles.name }).from(roles)
  return ok({ data })
}
