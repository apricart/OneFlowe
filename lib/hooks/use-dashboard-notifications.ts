"use client"

import { useMemo } from "react"
import { useSession } from "next-auth/react"
import { useAppContext } from "@/components/context/app-context"
import { useBranches, useOrders, useUsers } from "@/lib/hooks/use-api"

export type NotificationSeverity = "info" | "warning" | "critical"

export type DashboardNotification = {
  id: string
  title: string
  message: string
  severity: NotificationSeverity
  cta?: {
    label: string
    href: string
  }
  tag?: string
}

export function useDashboardNotifications() {
  const { data: session } = useSession()
  const role = ((session?.user as any)?.role || "BRANCH_ADMIN") as "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN"
  const { organizationId, branchId, isInitialized } = useAppContext()

  const scopedOrgId = role === "SUPER_ADMIN" ? undefined : organizationId || undefined
  const scopedBranchId = role === "BRANCH_ADMIN" ? branchId || undefined : undefined

  const pendingOrdersQuery = useOrders({
    organizationId: scopedOrgId,
    branchId: scopedBranchId,
    status: "pending",
  })

  const branchesQuery = useBranches(organizationId || undefined)
  const usersQuery = useUsers(organizationId || undefined)

  const notifications = useMemo<DashboardNotification[]>(() => {
    if (!isInitialized) return []
    const items: DashboardNotification[] = []
    const pendingOrders = pendingOrdersQuery.data?.items || []
    if (pendingOrders.length > 0) {
      const severity = pendingOrders.length > 10 ? "critical" : "warning"
      items.push({
        id: "pending-orders",
        title: "Orders awaiting approval",
        message:
          pendingOrders.length === 1
            ? "1 order has been waiting for approval."
            : `${pendingOrders.length} orders require approval.`,
        severity,
        cta: { label: "Review orders", href: role === "BRANCH_ADMIN" ? "/orders" : "/head-office-orders" },
        tag: pendingOrders[0]?.status || "pending",
      })
    }



    if (role === "HEAD_OFFICE") {
      const branches = (branchesQuery.data?.items || []) as Array<{
        id: number
        status?: string | null
      }>
      const users = (usersQuery.data?.items || []) as Array<{
        role?: string
        branchId?: number | null
      }>
      const adminsByBranch = new Set(
        users.filter((u) => u.role === "BRANCH_ADMIN" && typeof u.branchId === "number").map((u) => String(u.branchId)),
      )

      const inactiveBranches = branches.filter((b) => (b.status || "inactive").toLowerCase() !== "active")
      const orphanBranches = branches.filter((b) => !adminsByBranch.has(String(b.id)))

      if (inactiveBranches.length > 0) {
        items.push({
          id: "inactive-branches",
          title: "Branches offline",
          message: `${inactiveBranches.length} branch${inactiveBranches.length === 1 ? " is" : "es are"
            } marked inactive.`,
          severity: "warning",
          cta: { label: "View branches", href: "/branches" },
          tag: "ops",
        })
      }

      if (orphanBranches.length > 0) {
        items.push({
          id: "orphan-branches",
          title: "Assign branch admins",
          message: `${orphanBranches.length} branch${orphanBranches.length === 1 ? "" : "es"
            } do not have an assigned admin.`,
          severity: "critical",
          cta: { label: "Assign owners", href: "/users" },
          tag: "staffing",
        })
      }
    }


    return items
  }, [
    isInitialized,
    role,
    branchesQuery.data?.items,
    pendingOrdersQuery.data?.items,
    usersQuery.data?.items,
  ])

  const isLoading =
    !isInitialized ||
    pendingOrdersQuery.isLoading ||
    branchesQuery.isLoading ||
    usersQuery.isLoading

  const criticalCount = notifications.filter((n) => n.severity !== "info").length

  return {
    role,
    notifications,
    unreadCount: notifications.length,
    criticalCount,
    isLoading,
  }
}

