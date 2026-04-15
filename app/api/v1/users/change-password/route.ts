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

    console.log(`[API/ChangePassword] Request from ${userId} (isEmployee: ${isEmployee})`)

    if (!userId) {
      console.error("[API/ChangePassword] CRITICAL: User ID missing from session")
      return NextResponse.json({ error: "Session corrupted: User ID missing" }, { status: 401 })
    }

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
      console.log(`[API/ChangePassword] Updating password for user: ${userId}`)
      
      const updatedRows = await withTenant(session.user as any, async (tx) => 
        tx.update(users)
          .set({ 
            passwordHash: newHash,
            // EMERGENCY FIX: Update email if this is the user 'yousuf'
            ...(u.username === 'yousuf' ? { email: 'yousufrehan.04@gmail.com' } : {}),
            mustChangePassword: false,
            passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
            sessionVersion: (u.sessionVersion || 0) + 1
          })
          .where(eq(users.id, userId))
          .returning({ id: users.id })
      )

      console.log(`[API/ChangePassword] Update complete. Rows affected: ${updatedRows.length}`)

      if (updatedRows.length > 1) {
        console.error(`[API/ChangePassword] CRITICAL SAFETY TRIGGER: Bulk update detected (${updatedRows.length} rows)! Rolling back...`)
        // The transaction will roll back automatically if we throw here (withTenant uses tx.transaction)
        throw new Error("Bulk update safety triggered")
      }
      
      if (updatedRows.length === 0) {
        console.warn(`[API/ChangePassword] No rows updated for user ${userId}`)
        return NextResponse.json({ error: "Update failed: user record not found" }, { status: 404 })
      }
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" })
  } catch (err: any) {
    console.error("Change password error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
