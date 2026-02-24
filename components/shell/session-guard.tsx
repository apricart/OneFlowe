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

    // Track if user was ever authenticated in this page load
    useEffect(() => {
        if (status === "authenticated") {
            hasBeenAuthenticated.current = true
        }
    }, [status])

    useEffect(() => {
        // Only act if the user WAS authenticated but now isn't
        // This prevents redirect loops on public pages
        if (status === "unauthenticated" && hasBeenAuthenticated.current) {
            console.log("[SessionGuard] Session invalidated, logging out...")

            // Determine correct login page based on current path
            const loginPath = pathname?.startsWith("/shop") ? "/shop/login" : "/login"

            // Clean up and redirect
            signOut({ redirect: false }).then(() => {
                // Clear any stale local storage
                try {
                    localStorage.removeItem("theme")
                } catch (_) { }
                window.location.replace(loginPath)
            })
        }
    }, [status, pathname])

    return <>{children}</>
}
