import { withSuperAdmin } from "@/lib/db"
import { users, employeeCredentials } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

/**
 * Check if a username is available across both users and employee_credentials tables.
 * This is a global check that must bypass RLS to ensure system-wide uniqueness.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username")?.toLowerCase().trim()

    if (!username || username.length < 3) {
      return NextResponse.json({ available: false, suggestions: [] })
    }

    const result = await withSuperAdmin(async (tx) => {
      // Check availability in both tables
      const [userMatch] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1)

      const [empMatch] = await tx
        .select({ id: employeeCredentials.id })
        .from(employeeCredentials)
        .where(eq(employeeCredentials.username, username))
        .limit(1)

      const isAvailable = !userMatch && !empMatch

      if (isAvailable) {
        return { available: true, suggestions: [] }
      }

      // Generate 3 suggestions
      const suggestions: string[] = []
      let counter = 1

      while (suggestions.length < 3) {
        const candidate = `${username}${counter}`
        
        const [uMatch] = await tx.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1)
        const [eMatch] = await tx.select({ id: employeeCredentials.id }).from(employeeCredentials).where(eq(employeeCredentials.username, candidate)).limit(1)

        if (!uMatch && !eMatch) {
          suggestions.push(candidate)
        }
        counter++
        // Safety break
        if (counter > 100) break
      }

      return { available: false, suggestions }
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("Username check error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

