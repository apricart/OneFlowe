"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useSession } from "next-auth/react"

// Types
type Role = "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN"

interface AppContextValue {
  // Current context
  organizationId: string | null
  branchId: string | null
  branchIds: string[]

  // User info
  userRole: Role | null
  userOrgId: number | null
  userBranchId: number | null

  // Actions
  setOrganizationId: (id: string | null) => void
  setBranchId: (id: string | null) => void
  setBranchIds: (ids: string[]) => void
  resetContext: () => void

  // UI State
  isInitialized: boolean
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

const STORAGE_KEY = "oneflowe:app-context"

export function AppContextProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()

  const [organizationId, setOrganizationIdState] = useState<string | null>(null)
  const [branchId, setBranchIdState] = useState<string | null>(null)
  const [branchIds, setBranchIdsState] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Get user info from session
  const userRole = (session?.user as any)?.role || null
  const userOrgId = (session?.user as any)?.organizationId || null
  const userBranchId = (session?.user as any)?.branchId || null

  // Initialize context from session and localStorage
  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      setIsInitialized(true)
      if (typeof window !== "undefined") {
        const path = window.location.pathname
        if (!path.includes("/login") && !path.includes("/auth/")) {
          const loginPath = path.startsWith("/shop") ? "/shop/login" : "/login"
          window.location.replace(loginPath)
        }
      }
      return
    }

    // Read from localStorage
    let savedContext: { organizationId: string | null; branchId: string | null; branchIds: string[] } | null = null
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) savedContext = JSON.parse(saved)
    } catch { }

    // Initialize based on role
    if (userRole === "SUPER_ADMIN") {
      // Super Admin: use saved context or null (global scope)
      setOrganizationIdState(savedContext?.organizationId || null)
      setBranchIdState(savedContext?.branchId || null)
      setBranchIdsState(savedContext?.branchIds || [])
    } else if (userRole === "HEAD_OFFICE") {
      // Head Office: force organization to user's org, use saved branch
      if (userOrgId) {
        setOrganizationIdState(String(userOrgId))
        setBranchIdState(savedContext?.branchId || null)
        setBranchIdsState(savedContext?.branchIds || [])
      }
    } else if (userRole === "BRANCH_ADMIN") {
      // Branch Admin: force both to user's assignment
      if (userOrgId && userBranchId) {
        setOrganizationIdState(String(userOrgId))
        setBranchIdState(String(userBranchId))
        setBranchIdsState([String(userBranchId)])
      }
    }

    setIsInitialized(true)
  }, [session, status, userRole, userOrgId, userBranchId])

  // Persist to localStorage whenever context changes
  useEffect(() => {
    if (!isInitialized) return

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ organizationId, branchId, branchIds })
      )
    } catch { }
  }, [organizationId, branchId, branchIds, isInitialized])

  // Actions
  const setOrganizationId = useCallback((id: string | null) => {
    setOrganizationIdState(id)
    // Clear branch when organization changes
    if (id !== organizationId) {
      setBranchIdState(null)
      setBranchIdsState([])
    }
  }, [organizationId])

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(id)
    if (id && !branchIds.includes(id)) {
      setBranchIdsState([id])
    } else if (!id) {
      setBranchIdsState([])
    }
  }, [branchIds])

  const setBranchIds = useCallback((ids: string[]) => {
    setBranchIdsState(ids)
    // If exactly one, sync to single branchId for backward compatibility
    if (ids.length === 1) {
      setBranchIdState(ids[0])
    } else {
      setBranchIdState(null)
    }
  }, [])

  const resetContext = useCallback(() => {
    if (userRole === "SUPER_ADMIN") {
      setOrganizationIdState(null)
      setBranchIdState(null)
      setBranchIdsState([])
    } else if (userRole === "HEAD_OFFICE" && userOrgId) {
      setOrganizationIdState(String(userOrgId))
      setBranchIdState(null)
      setBranchIdsState([])
    } else if (userRole === "BRANCH_ADMIN" && userOrgId && userBranchId) {
      setOrganizationIdState(String(userOrgId))
      setBranchIdState(String(userBranchId))
      setBranchIdsState([String(userBranchId)])
    }
  }, [userRole, userOrgId, userBranchId])

  const value: AppContextValue = {
    organizationId,
    branchId,
    branchIds,
    userRole,
    userOrgId,
    userBranchId,
    setOrganizationId,
    setBranchId,
    setBranchIds,
    resetContext,
    isInitialized,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Hook to use the app context
export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useAppContext must be used within AppContextProvider")
  }
  return context
}
