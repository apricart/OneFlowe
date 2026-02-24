"use client"

import { SessionProvider } from "next-auth/react"

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // Re-check session every 60 seconds to detect server-side invalidation
      // (e.g. password reset, email change, deactivation)
      refetchInterval={60}
      // Also re-check immediately when user returns to the tab
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  )
}
