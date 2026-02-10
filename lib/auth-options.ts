import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { users, roles, mfaCodes, employeeCredentials, organizations, branches } from "@/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { verifyPassword } from "@/lib/password"
import { checkMfaCooldown, verifyOTP, clearDailyCount } from "@/lib/mfa"
import { compare } from "bcryptjs"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },  // 8-hour expiry (bank-grade)
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
            mfaEnabled: users.mfaEnabled,
            isActive: users.isActive
          })
          .from(users)
          .where(eq(users.email, email))
        if (!u) return null

        const ok = await verifyPassword(password, u.hash)
        if (!ok) return null

        // Check organization status
        if (u.organizationId) {
          const [org] = await db
            .select({ status: organizations.status })
            .from(organizations)
            .where(eq(organizations.id, u.organizationId))
            .limit(1)

          if (!org || org.status !== 'active') {
            throw new Error('ORGANIZATION_INACTIVE')
          }
        }

        // Check branch status
        if (u.branchId) {
          const [branch] = await db
            .select({ status: branches.status })
            .from(branches)
            .where(eq(branches.id, u.branchId))
            .limit(1)

          if (!branch || branch.status !== 'active') {
            throw new Error('BRANCH_INACTIVE')
          }
        }

        // Check user status
        if (!u.isActive) {
          throw new Error('USER_INACTIVE')
        }

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
            mfaEnabled: users.mfaEnabled,
            isActive: users.isActive
          })
          .from(users)
          .where(eq(users.email, email))
        if (!u) return null

        const ok = await verifyPassword(password, u.hash)
        if (!ok) return null

        // Check organization status
        if (u.organizationId) {
          const [org] = await db
            .select({ status: organizations.status })
            .from(organizations)
            .where(eq(organizations.id, u.organizationId))
            .limit(1)

          if (!org || org.status !== 'active') {
            throw new Error('ORGANIZATION_INACTIVE')
          }
        }

        // Check branch status
        if (u.branchId) {
          const [branch] = await db
            .select({ status: branches.status })
            .from(branches)
            .where(eq(branches.id, u.branchId))
            .limit(1)

          if (!branch || branch.status !== 'active') {
            throw new Error('BRANCH_INACTIVE')
          }
        }

        // Check user status
        if (!u.isActive) {
          throw new Error('USER_INACTIVE')
        }

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
          return null
        }

        const [emp] = await db
          .select()
          .from(employeeCredentials)
          .where(and(eq(employeeCredentials.email, email), eq(employeeCredentials.isActive, true)))

        if (!emp) {
          return null
        }



        const passwordMatch = await compare(password, emp.passwordHash)
        if (!passwordMatch) {
          return null
        }

        // Check organization status
        if (emp.organizationId) {
          const [org] = await db
            .select({ status: organizations.status })
            .from(organizations)
            .where(eq(organizations.id, emp.organizationId))
            .limit(1)

          if (!org || org.status !== 'active') {
            throw new Error('ORGANIZATION_INACTIVE')
          }
        }

        // Check branch status
        if (emp.branchId) {
          const [branch] = await db
            .select({ status: branches.status })
            .from(branches)
            .where(eq(branches.id, emp.branchId))
            .limit(1)

          if (!branch || branch.status !== 'active') {
            throw new Error('BRANCH_INACTIVE')
          }
        }

        // Check employee status (already filtered by isActive in WHERE, but explicit check for clarity)
        if (!emp.isActive) {
          throw new Error('USER_INACTIVE')
        }



        // Check if MFA is enabled
        if (emp.mfaEnabled) {
          throw new Error("MFA_REQUIRED")
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
        } as any
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

        // Check organization status
        if (emp.organizationId) {
          const [org] = await db
            .select({ status: organizations.status })
            .from(organizations)
            .where(eq(organizations.id, emp.organizationId))
            .limit(1)

          if (!org || org.status !== 'active') {
            throw new Error('ORGANIZATION_INACTIVE')
          }
        }

        // Check branch status
        if (emp.branchId) {
          const [branch] = await db
            .select({ status: branches.status })
            .from(branches)
            .where(eq(branches.id, emp.branchId))
            .limit(1)

          if (!branch || branch.status !== 'active') {
            throw new Error('BRANCH_INACTIVE')
          }
        }

        // Check employee status
        if (!emp.isActive) {
          throw new Error('USER_INACTIVE')
        }

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
        token.isEmployee = (user as any).isEmployee
        token.employeeId = (user as any).employeeId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ; (session.user as any).id = token.sub
          ; (session.user as any).role = (token as any).role
          ; (session.user as any).organizationId = (token as any).organizationId
          ; (session.user as any).branchId = (token as any).branchId
          ; (session.user as any).fullName = (token as any).fullName
          ; (session.user as any).isEmployee = (token as any).isEmployee
          ; (session.user as any).employeeId = (token as any).employeeId
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
  },
}
