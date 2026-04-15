export const dynamic = 'force-dynamic'
import { withSuperAdmin } from "@/lib/db"
import { roles } from "@/db/schema"
import { getCached, CACHE_TTL } from "@/lib/cache-utils"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = session.user as any
    const allowedRoles = ["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"]
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = await getCached(
      'cache:roles:all',
      async () => {
        return await withSuperAdmin(async (tx) => {
          return await tx.select({ id: roles.id, name: roles.name }).from(roles)
        })
      },
      CACHE_TTL.STATIC
    )

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Roles GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

