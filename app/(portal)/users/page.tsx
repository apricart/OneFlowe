"use client"
import { useState, ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HeadOfficeUsersTable } from "@/components/users/head-office-users-table"
import { CreateUserDialog } from "@/components/users/create-user-dialog"
import { useAppContext } from "@/components/context/app-context"
import { Button } from "@/components/ui/button"
import { RefreshCw, Users, UserPlus, Building2, ShieldCheck, Sparkles } from "lucide-react"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/fetcher"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function UsersPage() {
  const { organizationId, branchId, userRole } = useAppContext()
  const [mfaView, setMfaView] = useState<"enabled" | "disabled">("enabled")

  const { data: usersData, mutate: mutateUsers } = useSWR(
    "/api/v1/users",
    fetcher
  )

  const { data: branchesData } = useSWR(
    organizationId ? `/api/v1/branches?organizationId=${organizationId}` : "/api/v1/branches",
    fetcher
  )
  const { data: organizationsData } = useSWR(
    "/api/v1/organizations",
    fetcher
  )

  const users = usersData?.items || []
  const branches = branchesData?.items || []
  const organizations = organizationsData?.items || []
  const organizationFilterId = organizationId ? parseInt(organizationId, 10) : null
  const branchFilterId = branchId ? parseInt(branchId, 10) : null

  // Filter users based on role and organization
  const filteredUsers = users.filter((user: any) => {
    if (userRole === "SUPER_ADMIN") {
      if (organizationFilterId && user.organizationId !== organizationFilterId) return false
    } else if (userRole === "HEAD_OFFICE") {
      if (!organizationFilterId || user.organizationId !== organizationFilterId) return false
    } else if (userRole === "BRANCH_ADMIN") {
      if (!branchFilterId || user.branchId !== branchFilterId) return false
    } else {
      return false
    }

    if (branchFilterId) {
      return user.branchId === branchFilterId
    }

    return true
  })

  // Calculate stats
  const stats = {
    total: filteredUsers.length,
    headOffice: filteredUsers.filter((u: any) => u.role === "HEAD_OFFICE").length,
    branchAdmin: filteredUsers.filter((u: any) => u.role === "BRANCH_ADMIN").length,
    mfaEnabled: filteredUsers.filter((u: any) => u.mfaEnabled).length,
    mfaDisabled: filteredUsers.filter((u: any) => !u.mfaEnabled).length,
  }
  const mfaLabel = mfaView === "enabled" ? "MFA Enabled" : "MFA Disabled"
  const mfaValue = mfaView === "enabled" ? stats.mfaEnabled : stats.mfaDisabled
  const mfaColorClass = mfaView === "enabled" ? "text-purple-600" : "text-orange-500"

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-8">
      <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-indigo-900 to-indigo-700 text-white shadow-xl">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
        </div>
        <CardHeader className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
              <Sparkles className="h-4 w-4" />
              Workforce Control
            </p>
            <CardTitle className="text-3xl font-semibold text-white">User management</CardTitle>
            <p className="text-sm text-white/80">
              Curate every Head Office and Branch Admin seat across your network with instant context and security status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => mutateUsers()}>
              <RefreshCw className="h-4 w-4" />
              Refresh data
            </Button>
            <CreateUserDialog onSuccess={() => mutateUsers()} />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total users"
          value={stats.total}
          helper="All active seats"
          accent="from-indigo-500 to-sky-500"
          icon={<Users className="h-5 w-5 text-white" />}
        />
        <SummaryCard
          label="Head office"
          value={stats.headOffice}
          helper={`${stats.branchAdmin} branch admins`}
          accent="from-blue-500 to-cyan-500"
          icon={<Building2 className="h-5 w-5 text-white" />}
        />
        <SummaryCard
          label="MFA coverage"
          value={`${stats.mfaEnabled}/${stats.total}`}
          helper={`${Math.round((stats.mfaEnabled / (stats.total || 1)) * 100)}% enabled`}
          accent="from-emerald-500 to-lime-500"
          icon={<ShieldCheck className="h-5 w-5 text-white" />}
        />
        <Card className="p-4 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{mfaLabel}</p>
              <p className={`text-3xl font-semibold ${mfaColorClass}`}>{mfaValue}</p>
            </div>
            <div className="flex overflow-hidden rounded-md border bg-muted/40">
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-none px-3 text-xs ${mfaView === "enabled" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setMfaView("enabled")}
              >
                Enabled
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-none px-3 text-xs ${mfaView === "disabled" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setMfaView("disabled")}
              >
                Disabled
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Toggle to see where action is needed.</p>
        </Card>
      </div>

      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5" />
              Directory
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {userRole === "HEAD_OFFICE" ? "Head Office view • scoped to your organization" : "Global visibility"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <HeadOfficeUsersTable
            users={filteredUsers}
            branches={branches}
            organizations={organizations}
            userRole={userRole ?? undefined}
            onUserUpdate={() => mutateUsers()}
          />
        </CardContent>
      </Card>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
  accent,
}: {
  label: string
  value: string | number
  helper: string
  icon: ReactNode
  accent: string
}) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r ${accent}`}>
            {icon}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}