"use client"

import { SessionProvider } from "next-auth/react"

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // Re-check session every 2 minutes to detect server-side invalidation
      // (e.g. password reset, email change, deactivation). Polling is only the
      // UI-redirect path: every API call is independently re-validated server-side
      // (requireApiRole/getServerSession), so a deactivated user is blocked from
      // data immediately regardless of this interval.
      refetchInterval={120}
      // Also re-check immediately when user returns to the tab
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  )
}
