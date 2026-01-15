import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { systemLogs } from "@/db/schema"
import { and, desc, eq, gte, lte, sql } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role

  // Only Super Admin can view all logs. Head Office/Branch Admin might view their own?
  // Requirement: "Create audit log viewer for Super Admin"
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const searchParams = req.nextUrl.searchParams
  const page = Number(searchParams.get("page") || "1")
  const limit = Number(searchParams.get("limit") || "50")
  const offset = (page - 1) * limit

  const action = searchParams.get("action")
  const resourceType = searchParams.get("resourceType")
  const userId = searchParams.get("userId")

  const conditions = []

  if (action) conditions.push(eq(systemLogs.action, action))
  if (resourceType) conditions.push(eq(systemLogs.resourceType, resourceType))
  if (userId) conditions.push(eq(systemLogs.userId, userId))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const items = await db.select()
    .from(systemLogs)
    .where(whereClause)
    .orderBy(desc(systemLogs.createdAt))
    .limit(limit)
    .offset(offset)

  // Get total count (approximation or separate query)
  // For simplicity, just return items for now. 
  // Ideally we want count.

  return NextResponse.json({
    items,
    page,
    limit
  })
}
