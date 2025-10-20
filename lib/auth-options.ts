import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { users, roles, mfaCodes } from "@/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { verifyPassword } from "@/lib/password"
import { checkMfaCooldown, verifyOTP, clearDailyCount } from "@/lib/mfa"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase()
        const password = String(credentials?.password || "")
        if (!email || !password) return null
        
        const [u] = await db
          .select({ 
            id: users.id, 
            email: users.email, 
            hash: users.passwordHash, 
            roleId: users.roleId,
            organizationId: users.organizationId,
            branchId: users.branchId,
            fullName: users.fullName,
            mfaEnabled: users.mfaEnabled
          })
          .from(users)
          .where(eq(users.email, email))
        if (!u) return null
        
        const ok = await verifyPassword(password, u.hash)
        if (!ok) return null
        
        // Check if MFA is enabled for this user
        if (u.mfaEnabled) {
          // Return special error to trigger MFA flow
          // Cooldown will be checked when sending OTP, not during initial login
          throw new Error("MFA_REQUIRED")
        }
        
        // Clear daily count after successful login (for non-MFA users)
        await clearDailyCount(u.id)
        
        const [r] = await db.select().from(roles).where(eq(roles.id, u.roleId))
        return { 
          id: u.id, 
          email: u.email, 
          role: r?.name || "BRANCH_ADMIN",
          organizationId: u.organizationId,
          branchId: u.branchId,
          fullName: u.fullName
        } as any
      },
    }),
    Credentials({
      id: "mfa-credentials",
      name: "mfa-credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase()
        const password = String(credentials?.password || "")
        const otp = String(credentials?.otp || "")
        
        if (!email || !password || !otp) return null
        
        // Verify credentials first
        const [u] = await db
          .select({ 
            id: users.id, 
            email: users.email, 
            hash: users.passwordHash, 
            roleId: users.roleId,
            organizationId: users.organizationId,
            branchId: users.branchId,
            fullName: users.fullName,
            mfaEnabled: users.mfaEnabled
          })
          .from(users)
          .where(eq(users.email, email))
        if (!u) return null
        
        const ok = await verifyPassword(password, u.hash)
        if (!ok) return null
        
        if (!u.mfaEnabled) return null
        
        // Verify OTP
        const mfaResult = await verifyOTP(u.id, otp, 'LOGIN')
        if (!mfaResult.success) {
          throw new Error(mfaResult.message)
        }
        
        // Clear daily count after successful login
        await clearDailyCount(u.id)
        
        const [r] = await db.select().from(roles).where(eq(roles.id, u.roleId))
        return { 
          id: u.id, 
          email: u.email, 
          role: r?.name || "BRANCH_ADMIN",
          organizationId: u.organizationId,
          branchId: u.branchId,
          fullName: u.fullName
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.organizationId = (user as any).organizationId
        token.branchId = (user as any).branchId
        token.fullName = (user as any).fullName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.sub
        ;(session.user as any).role = (token as any).role
        ;(session.user as any).organizationId = (token as any).organizationId
        ;(session.user as any).branchId = (token as any).branchId
        ;(session.user as any).fullName = (token as any).fullName
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}
