import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { users, roles, mfaCodes, employeeCredentials, organizations, branches } from "@/db/schema"
import { eq, and, gt, isNull, sql, or } from "drizzle-orm"
import { verifyPassword } from "@/lib/password"
import { checkMfaCooldown, verifyOTP, clearDailyCount } from "@/lib/mfa"
import { compare } from "bcryptjs"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },  // 8-hour expiry (bank-grade)
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username || "").trim().toLowerCase()
        const password = String(credentials?.password || "")
        if (!username || !password) return null

        const [u] = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            hash: users.passwordHash,
            roleId: users.roleId,
            organizationId: users.organizationId,
            branchId: users.branchId,
            fullName: users.fullName,
            mfaEnabled: users.mfaEnabled,
            isActive: users.isActive,
            sessionVersion: users.sessionVersion
          })
          .from(users)
          .where(and(or(eq(users.username, username), sql`lower(${users.email}) = ${username}`), isNull(users.deletedAt)))
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

          if (!org || org.status?.toLowerCase() !== 'active') {
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

          if (!branch || branch.status?.toLowerCase() !== 'active') {
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
          username: u.username,
          role: r?.name || "BRANCH_ADMIN",
          organizationId: u.organizationId,
          branchId: u.branchId,
          fullName: u.fullName,
          isEmployee: false,
          sessionVersion: u.sessionVersion
        } as any
      },
    }),
    Credentials({
      id: "mfa-credentials",
      name: "mfa-credentials",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
        otp: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username || "").trim().toLowerCase()
        const password = String(credentials?.password || "")
        const otp = String(credentials?.otp || "")

        if (!username || !password || !otp) return null

        // Verify credentials first
        const [u] = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            hash: users.passwordHash,
            roleId: users.roleId,
            organizationId: users.organizationId,
            branchId: users.branchId,
            fullName: users.fullName,
            mfaEnabled: users.mfaEnabled,
            isActive: users.isActive,
            sessionVersion: users.sessionVersion
          })
          .from(users)
          .where(and(or(eq(users.username, username), sql`lower(${users.email}) = ${username}`), isNull(users.deletedAt)))
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

          if (!org || org.status?.toLowerCase() !== 'active') {
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

          if (!branch || branch.status?.toLowerCase() !== 'active') {
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
          username: u.username,
          role: r?.name || "BRANCH_ADMIN",
          organizationId: u.organizationId,
          branchId: u.branchId,
          fullName: u.fullName,
          isEmployee: false,
          sessionVersion: u.sessionVersion
        } as any
      },
    }),
    // Employee Portal Login
    Credentials({
      id: "employee-credentials",
      name: "employee-credentials",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username || "").trim().toLowerCase()
        const password = String(credentials?.password || "")
        if (!username || !password) {
          return null
        }

        const [emp] = await db
          .select()
          .from(employeeCredentials)
          .where(and(or(eq(employeeCredentials.username, username), sql`lower(${employeeCredentials.email}) = ${username}`), eq(employeeCredentials.isActive, true)))

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

          if (!org || org.status?.toLowerCase() !== 'active') {
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

          if (!branch || branch.status?.toLowerCase() !== 'active') {
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
          username: emp.username,
          role: "EMPLOYEE",
          organizationId: emp.organizationId,
          branchId: emp.branchId,
          fullName: `${emp.firstName} ${emp.lastName}`.trim(),
          isEmployee: true,
          employeeId: emp.id,
          sessionVersion: emp.sessionVersion
        } as any
      },
    }),
    // Employee MFA Login
    Credentials({
      id: "employee-mfa-credentials",
      name: "employee-mfa-credentials",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
        otp: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username || "").trim().toLowerCase()
        const password = String(credentials?.password || "")
        const otp = String(credentials?.otp || "")

        if (!username || !password || !otp) return null

        const [emp] = await db
          .select()
          .from(employeeCredentials)
          .where(and(or(eq(employeeCredentials.username, username), sql`lower(${employeeCredentials.email}) = ${username}`), eq(employeeCredentials.isActive, true)))

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

          if (!org || org.status?.toLowerCase() !== 'active') {
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

          if (!branch || branch.status?.toLowerCase() !== 'active') {
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
          username: emp.username,
          role: "EMPLOYEE",
          organizationId: emp.organizationId,
          branchId: emp.branchId,
          fullName: `${emp.firstName} ${emp.lastName}`.trim(),
          isEmployee: true,
          employeeId: emp.id,
          sessionVersion: emp.sessionVersion
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
        token.username = (user as any).username
        token.isEmployee = (user as any).isEmployee
        token.employeeId = (user as any).employeeId
        token.sessionVersion = (user as any).sessionVersion
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // Essential session assignments (always run)
        (session.user as any).id = token.sub
          ; (session.user as any).role = (token as any).role
          ; (session.user as any).organizationId = (token as any).organizationId
          ; (session.user as any).branchId = (token as any).branchId
          ; (session.user as any).fullName = (token as any).fullName
          ; (session.user as any).username = (token as any).username
          ; (session.user as any).isEmployee = (token as any).isEmployee
          ; (session.user as any).employeeId = (token as any).employeeId

        // Bank-grade security: Verify user is still active and not deleted on every session check
        // This ensures that password resets, deletions, or deactivations kick users out immediately
        try {
          const isEmployee = token.isEmployee === true
          const userId = token.sub as string

          if (!userId) return session

          let dbUser: { isActive: boolean, deletedAt: Date | null, sessionVersion: number } | null = null

          if (isEmployee) {
            // Employee ID in token sub is "emp_123", we need the numeric ID for DB lookup
            const numericId = parseInt(userId.replace("emp_", ""), 10)
            const [emp] = await db
              .select({
                isActive: employeeCredentials.isActive,
                deletedAt: sql<Date | null>`NULL`,
                sessionVersion: employeeCredentials.sessionVersion
              })
              .from(employeeCredentials)
              .where(eq(employeeCredentials.id, numericId))
              .limit(1)
            dbUser = emp as any
          } else {
            const [u] = await db
              .select({
                isActive: users.isActive,
                deletedAt: users.deletedAt,
                sessionVersion: users.sessionVersion
              })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1)
            dbUser = u as any
          }

          if (!dbUser || !dbUser.isActive || (dbUser.deletedAt && !isEmployee) || dbUser.sessionVersion !== token.sessionVersion) {
            console.log(`[Auth] Invaliding session for user ${userId}: Status/Version mismatch`)
            return null as any
          }

          // Also check for organization and branch status in session check
          if (token.organizationId) {
            const [org] = await db.select({ status: organizations.status }).from(organizations).where(eq(organizations.id, token.organizationId as number)).limit(1)
            if (!org || org.status?.toLowerCase() !== 'active') {
              console.log(`[Auth] Invaliding session for user ${userId}: Org deactivated`)
              return null as any
            }
          }

          if (token.branchId) {
            const [branch] = await db.select({ status: branches.status }).from(branches).where(eq(branches.id, token.branchId as number)).limit(1)
            if (!branch || branch.status?.toLowerCase() !== 'active') {
              console.log(`[Auth] Invaliding session for user ${userId}: Branch deactivated`)
              return null as any
            }
          }
        } catch (err) {
          console.error("[Auth] Session validation error:", err)
          // On DB error, we allow the session to continue but log the error
          // This prevents a DB hiccup from locking everyone out
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}
