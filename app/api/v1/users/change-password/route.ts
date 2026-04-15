import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db, withTenant } from "@/lib/db"
import { users, employeeCredentials } from "@/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword } from "@/lib/password"
import { compare as comparePasswords } from "bcryptjs"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new passwords are required" }, { status: 400 })
    }

    const userId = (session.user as any).id
    const isEmployee = (session.user as any).isEmployee

    if (isEmployee) {
      const numericId = parseInt(userId.replace("emp_", ""), 10)
      const [emp] = await withTenant(session.user as any, async (tx) => 
        tx.select().from(employeeCredentials).where(eq(employeeCredentials.id, numericId)).limit(1)
      )

      if (!emp) return NextResponse.json({ error: "User not found" }, { status: 404 })

      const passwordMatch = await comparePasswords(currentPassword, emp.passwordHash)
      if (!passwordMatch) return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })

      const newHash = await hashPassword(newPassword)
      await withTenant(session.user as any, async (tx) => 
        tx.update(employeeCredentials)
          .set({ 
            passwordHash: newHash,
            mustChangePassword: false,
            passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Next expiry in 90 days
            updatedAt: new Date(),
            sessionVersion: (emp.sessionVersion || 0) + 1 // Invalidate other sessions
          })
          .where(eq(employeeCredentials.id, numericId))
      )
    } else {
      const [u] = await withTenant(session.user as any, async (tx) => 
        tx.select().from(users).where(eq(users.id, userId)).limit(1)
      )

      if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 })

      const passwordMatch = await comparePasswords(currentPassword, u.passwordHash)
      if (!passwordMatch) return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })

      const newHash = await hashPassword(newPassword)
      await withTenant(session.user as any, async (tx) => 
        tx.update(users)
          .set({ 
            passwordHash: newHash,
            mustChangePassword: false,
            passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
            sessionVersion: (u.sessionVersion || 0) + 1
          })
          .where(eq(users.id, userId))
      )
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" })
  } catch (err: any) {
    console.error("Change password error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
