import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { users, roles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { verifyPassword } from "@/lib/password"

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
          .select({ id: users.id, email: users.email, hash: users.passwordHash, roleId: users.roleId })
          .from(users)
          .where(eq(users.email, email))
        if (!u) return null
        const ok = await verifyPassword(password, u.hash)
        if (!ok) return null
        const [r] = await db.select().from(roles).where(eq(roles.id, u.roleId))
        return { id: u.id, email: u.email, role: r?.name || "BRANCH_ADMIN" } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.sub
        ;(session.user as any).role = (token as any).role
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}


