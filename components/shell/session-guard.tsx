"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

/**
 * SessionGuard - Monitors session status and automatically redirects
 * to the login page when the session becomes invalid.
 *
 * This handles scenarios like:
 * - Admin resets a user's password → sessionVersion mismatch → session returns null
 * - Admin changes a user's email → sessionVersion mismatch → session returns null
 * - User is deactivated or deleted
 * - Organization or branch is deactivated
 *
 * Works across all browsers including Firefox where cookie cleanup
 * may behave differently.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession()
    const pathname = usePathname()
    const hasBeenAuthenticated = useRef(false)
    const lastKnownRole = useRef<string | null>(null)
    const isLoggingOut = useRef(false)

    // Track if user was ever authenticated in this page load
    useEffect(() => {
        if (status === "authenticated" && session?.user) {
            hasBeenAuthenticated.current = true
            lastKnownRole.current = (session.user as any).role
        }
    }, [status, session])

    // Listen for manual logout events to prevent double-triggering
    useEffect(() => {
        const handleManualLogout = () => {
            isLoggingOut.current = true
        }
        window.addEventListener('beforeunload', handleManualLogout)
        return () => window.removeEventListener('beforeunload', handleManualLogout)
    }, [])

    useEffect(() => {
        // Only act if the user WAS authenticated but now isn't
        // AND we aren't already in the middle of a manual logout
        if (status === "unauthenticated" && hasBeenAuthenticated.current && !isLoggingOut.current) {
            console.log("[SessionGuard] Session invalidated, logging out...")

            // Logic for redirecting to the correct portal login:
            // 1. If they were an admin (any admin role), they ALWAYS go to /login
            // 2. If they were an employee/order portal user, they go to /login
            // 3. Fallback: use pathname logic
            
            const loginPath = "/login"

            isLoggingOut.current = true
            
            // Clean up and redirect using standard NextAuth flow
            signOut({ 
                redirect: true, 
                callbackUrl: loginPath 
            }).then(() => {
                // Clear any stale local storage
                try {
                    localStorage.removeItem("theme")
                    localStorage.removeItem("ctx.organizationId")
                    localStorage.removeItem("ctx.branchId")
                } catch (_) { }
            })
        }
    }, [status, pathname])

    return <>{children}</>
}
