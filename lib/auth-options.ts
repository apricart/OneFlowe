import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { users, roles, mfaCodes, employeeCredentials } from "@/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { verifyPassword } from "@/lib/password"
import { checkMfaCooldown, verifyOTP, clearDailyCount } from "@/lib/mfa"
import { compare } from "bcryptjs"

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
          fullName: u.fullName,
          isEmployee: false
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
          fullName: u.fullName,
          isEmployee: false
        } as any
      },
    }),
    // Employee Portal Login
    Credentials({
      id: "employee-credentials",
      name: "employee-credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase()
        const password = String(credentials?.password || "")
        if (!email || !password) {
          console.log("❌ Employee login: missing email or password")
          return null
        }

        const [emp] = await db
          .select()
          .from(employeeCredentials)
          .where(and(eq(employeeCredentials.email, email), eq(employeeCredentials.isActive, true)))

        if (!emp) {
          console.log(`❌ Employee login: no active employee found for ${email}`)
          return null
        }

        console.log(`✓ Employee found: ${emp.email}`)

        const passwordMatch = await compare(password, emp.passwordHash)
        if (!passwordMatch) {
          console.log(`❌ Employee login: password mismatch for ${email}`)
          return null
        }

        console.log(`✓ Employee password matched for ${email}`)

        // Check if MFA is enabled
        if (emp.mfaEnabled) {
          console.log(`✓ Employee MFA required for ${email}`)
          throw new Error("MFA_REQUIRED")
        }

        console.log(`✓ Employee login successful for ${email}`)
        return {
          id: `emp_${emp.id}`,
          email: emp.email,
          role: "EMPLOYEE",
          organizationId: emp.organizationId,
          branchId: emp.branchId,
          fullName: `${emp.firstName} ${emp.lastName}`.trim(),
          isEmployee: true,
          employeeId: emp.id
        }
      },
    }),
    // Employee MFA Login
    Credentials({
      id: "employee-mfa-credentials",
      name: "employee-mfa-credentials",
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

        const [emp] = await db
          .select()
          .from(employeeCredentials)
          .where(and(eq(employeeCredentials.email, email), eq(employeeCredentials.isActive, true)))

        if (!emp) return null

        const passwordMatch = await compare(password, emp.passwordHash)
        if (!passwordMatch) return null

        if (!emp.mfaEnabled || !emp.mfaSecret) return null

        // Verify OTP for employee
        const mfaResult = await verifyOTP(`emp_${emp.id}`, otp, 'LOGIN')
        if (!mfaResult.success) {
          throw new Error(mfaResult.message)
        }

        return {
          id: `emp_${emp.id}`,
          email: emp.email,
          role: "EMPLOYEE",
          organizationId: emp.organizationId,
          branchId: emp.branchId,
          fullName: `${emp.firstName} ${emp.lastName}`.trim(),
          isEmployee: true,
          employeeId: emp.id
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.organizationId = user.organizationId
        token.branchId = user.branchId
        token.fullName = user.fullName
        token.isEmployee = user.isEmployee
        token.employeeId = user.employeeId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role
        session.user.organizationId = token.organizationId
        session.user.branchId = token.branchId
        session.user.fullName = token.fullName
        session.user.isEmployee = token.isEmployee
        session.user.employeeId = token.employeeId
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
  },
}
