"use client"
import { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HeadOfficeUsersTable } from "@/components/users/head-office-users-table"
import { CreateUserDialog } from "@/components/users/create-user-dialog"
import { useAppContext } from "@/components/context/app-context"
import { Button } from "@/components/ui/button"
import { RefreshCw, Users, UserPlus, Building2, UserCircle } from "lucide-react"
import useSWR from "swr"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function UsersPage() {
  const { organizationId, branchId, userRole } = useAppContext()

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
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50/50 dark:bg-slate-950 p-4 md:p-8 space-y-6">
      {/* Compact Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 md:p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center border border-indigo-50/50 dark:border-indigo-800/50 shadow-inner">
            <UserCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">User Management</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Global workforce directory & permissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 shadow-sm" onClick={() => mutateUsers()}>
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <CreateUserDialog onSuccess={() => mutateUsers()} />
        </div>
      </div>

      {/* Ultra-compact Colorful Light Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <CompactStatCard
          label="Total Active Users"
          value={stats.total}
          icon={<Users className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-indigo-50/80 to-blue-50/80 border-indigo-100/50 text-indigo-700 dark:from-indigo-900/20 dark:to-blue-900/20 dark:border-indigo-800/30 dark:text-indigo-400"
          iconBadge="bg-white/80 text-indigo-600 shadow-sm border border-indigo-100 dark:bg-slate-800 dark:border-indigo-800"
        />
        <CompactStatCard
          label="Head Office"
          value={stats.headOffice}
          icon={<Building2 className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-teal-50/80 to-emerald-50/80 border-teal-100/50 text-teal-700 dark:from-teal-900/20 dark:to-emerald-900/20 dark:border-teal-800/30 dark:text-teal-400"
          iconBadge="bg-white/80 text-teal-600 shadow-sm border border-teal-100 dark:bg-slate-800 dark:border-teal-800"
        />
        <CompactStatCard
          label="Branch Admins"
          value={stats.branchAdmin}
          icon={<UserPlus className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-fuchsia-50/80 to-purple-50/80 border-fuchsia-100/50 text-fuchsia-700 dark:from-fuchsia-900/20 dark:to-purple-900/20 dark:border-fuchsia-800/30 dark:text-fuchsia-400"
          iconBadge="bg-white/80 text-fuchsia-600 shadow-sm border border-fuchsia-100 dark:bg-slate-800 dark:border-fuchsia-800"
        />
      </div>

      {/* Main Directory Area */}
      <div className="flex flex-col pt-2">
        <HeadOfficeUsersTable
          users={filteredUsers}
          branches={branches}
          organizations={organizations}
          userRole={userRole ?? undefined}
          onUserUpdate={() => mutateUsers()}
        />
      </div>
    </main>
  )
}

function CompactStatCard({
  label,
  value,
  icon,
  gradient,
  iconBadge,
}: {
  label: string
  value: string | number
  icon: ReactNode
  gradient: string
  iconBadge: string
}) {
  return (
    <Card className={cn("border rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5", gradient)}>
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
            {label}
          </p>
          <p className="text-4xl font-black tracking-tight">
            {value}
          </p>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconBadge)}>
           {icon}
        </div>
      </CardContent>
    </Card>
  )
}