"use client"

import { useEffect, useMemo, useState } from "react"
import { useBranches, useUsers } from "@/lib/hooks/use-api"
import { fetcher } from "@/lib/fetcher"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Building2, Users, RefreshCcw, Search, Boxes, UserCog, Sparkles, ShieldCheck, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Branch = {
  id: number
  name: string
  code?: string | null
  status?: string | null
  adminUserId?: string | null
  createdAt?: string
}

type User = {
  id: string
  firstName?: string
  lastName?: string
  email: string
  branchId?: number | null
  role?: string
}

export default function BranchesPage() {
  const router = useRouter()
  const { organizationId, userRole, isInitialized, setBranchId } = useAppContext()
  const { data: branchesRes, isLoading, isValidating: isRefreshingBranches, mutate: refetchBranches } = useBranches(organizationId || undefined)
  const { data: usersRes, isValidating: isRefreshingUsers, mutate: refetchUsers } = useUsers(organizationId || undefined)

  const PAGE_SIZE = 20
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [page, setPage] = useState(1)
  const [updatingBranchId, setUpdatingBranchId] = useState<number | null>(null)
  const [manualRefreshing, setManualRefreshing] = useState(false)

  const branches = (branchesRes?.items as Branch[] | undefined) || []
  const users = (usersRes?.items as User[] | undefined) || []

  const branchAdmins = useMemo(() => users.filter((u) => u.role === "BRANCH_ADMIN" && u.branchId), [users])
  const adminByBranch = useMemo(
    () => Object.fromEntries(branchAdmins.map((admin) => [String(admin.branchId), admin])),
    [branchAdmins],
  )

  const filteredBranches = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return branches.filter((branch) => {
      const matchesSearch =
        !normalized ||
        branch.name.toLowerCase().includes(normalized) ||
        (branch.code || "").toLowerCase().includes(normalized)

      const status = (branch.status || "active").toLowerCase()
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? status === "active" : status !== "active")

      return matchesSearch && matchesStatus
    })
  }, [branches, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / PAGE_SIZE))

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages) || 1)
  }, [totalPages])

  const paginatedBranches = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredBranches.slice(start, start + PAGE_SIZE)
  }, [filteredBranches, page])

  const totalBranches = branches.length
  const activeBranches = branches.filter((b) => (b.status || "active").toLowerCase() === "active").length
  const inactiveBranches = totalBranches - activeBranches
  const branchesWithAdmins = Object.keys(adminByBranch).length
  const coverage = totalBranches ? Math.round((branchesWithAdmins / totalBranches) * 100) : 0

  const isRefreshing = manualRefreshing || isRefreshingBranches || isRefreshingUsers

  const handleRefresh = async () => {
    const addRefreshParam = (url: string) => {
      const separator = url.includes("?") ? "&" : "?"
      return `${url}${separator}refresh=${Date.now()}`
    }

    const branchUrl = `/api/v1/branches${organizationId ? `?organizationId=${organizationId}` : ""}`
    const usersUrl = `/api/v1/users${organizationId ? `?organizationId=${organizationId}` : ""}`

    setManualRefreshing(true)
    try {
      const [freshBranches, freshUsers] = await Promise.all([
        fetcher<{ items: Branch[] }>(addRefreshParam(branchUrl)),
        fetcher<{ items: User[] }>(addRefreshParam(usersUrl)),
      ])

      await Promise.all([
        refetchBranches(freshBranches, { revalidate: false }),
        refetchUsers(freshUsers, { revalidate: false }),
      ])
    } catch (error) {
      console.error("Failed to refresh branches page data", error)
    } finally {
      setManualRefreshing(false)
    }
  }

  const handleStatusToggle = async (branchId: number, currentStatus?: string | null) => {
    const nextStatus = (currentStatus || "active").toLowerCase() === "active" ? "inactive" : "active"
    setUpdatingBranchId(branchId)
    try {
      const payload: Record<string, any> = { status: nextStatus }
      if (organizationId) {
        payload.organizationId = Number(organizationId)
      }

      const response = await fetch(`/api/v1/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || "Failed to update branch status")
      }
      await refetchBranches()
    } catch (error) {
      console.error("Failed to update branch status", error)
    } finally {
      setUpdatingBranchId(null)
    }
  }

  if (!isInitialized) {
    return (
      <main className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={idx}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    )
  }

  if (userRole !== "HEAD_OFFICE") {
    return (
      <main className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You need Head Office access to view the My Branches workspace.
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-4 md:p-8 space-y-8">
      {/* Compact Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 md:p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 flex items-center justify-center border border-blue-50/50 dark:border-blue-800/50 shadow-inner">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Branches</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Manage and monitor branch performance and staffing</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-8 px-3 rounded-full border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/60 dark:text-blue-400 font-semibold uppercase tracking-wider text-[10px]">
            {totalBranches} Branches
          </Badge>
          <Button variant="outline" size="sm" onClick={() => { void handleRefresh() }} disabled={isRefreshing} className="h-9 gap-2 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 shadow-sm">
            <RefreshCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Branches"
          value={totalBranches}
          icon={<Building2 className="h-5 w-5" />}
          variant="blue"
        />
        <StatCard
          label="Active Branches"
          value={activeBranches}
          icon={<ShieldCheck className="h-5 w-5" />}
          variant="green"
        />
        {/* <StatCard
          label="Admin"
          value={`${coverage}%`}
          icon={<Users className="h-5 w-5" />}
          variant="purple"
        /> */}
        <StatCard
          label="Needs Attention"
          value={inactiveBranches}
          icon={<AlertCircle className="h-5 w-5" />}
          variant="red"
        />
      </div>

      <Card className="border-none shadow-[0_15px_60px_rgb(0,0,0,0.05)] dark:shadow-[0_15px_60px_rgb(0,0,0,0.3)] bg-white/80 dark:bg-[#050b1a]/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">Branch Directory</CardTitle>
              <p className="text-sm text-muted-foreground">Search and manage individual branch settings.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative group w-full lg:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  placeholder="Search branches..."
                  className="pl-9 h-10 bg-slate-100/50 dark:bg-slate-900/50 border-transparent focus:bg-white dark:focus:bg-slate-900 transition-all rounded-xl"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                <SelectTrigger className="h-10 w-full sm:w-40 rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-48 w-full rounded-2xl" />
              ))}
            </div>
          )}
          {!isLoading && filteredBranches.length === 0 && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No branches match your filters.
            </div>
          )}
          {!isLoading && filteredBranches.length > 0 && (
            <>
              <div className="flex flex-col gap-2 pb-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {filteredBranches.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                    –
                    {Math.min(filteredBranches.length, page * PAGE_SIZE)}
                  </span>{" "}
                  of <span className="font-medium text-foreground">{filteredBranches.length}</span> branches
                </span>
                <div className="inline-flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page <span className="font-medium text-foreground">{page}</span> / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={page === totalPages || filteredBranches.length === 0}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {paginatedBranches.map((branch) => {
                  const admin = adminByBranch[String(branch.id)]
                  const isActive = (branch.status || "active").toLowerCase() === "active"
                  const isUpdatingThisBranch = updatingBranchId === branch.id
                  return (
                    <div
                      key={branch.id}
                      className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                    >
                      {/* Subtle Background Accent */}
                      <div className={cn(
                        "absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-10 -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-20",
                        isActive ? "bg-emerald-500" : "bg-slate-500"
                      )} />

                      <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branch Name</p>
                          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{branch.name}</h3>
                        </div>
                        <Badge className={cn(
                          "rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shadow-sm",
                          isActive 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        )}>
                          {isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Boxes className="h-3 w-3 text-blue-500" /> Code
                          </p>
                          <p className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{branch.code || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-amber-500" /> Created
                          </p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {branch.createdAt ? new Date(branch.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="relative z-10 bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700/50 p-4 rounded-2xl mb-6">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Primary Admin</p>
                        {admin ? (
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/20">
                              {admin.firstName?.[0] || admin.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white truncate text-sm">
                                {[admin.firstName, admin.lastName].filter(Boolean).join(" ") || "Admin User"}
                              </p>
                              <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 opacity-60">
                            <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                              <Users className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-medium text-slate-500 italic">No admin assigned</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between relative z-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 px-4 gap-2 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-all"
                          onClick={() => {
                            setBranchId(String(branch.id))
                            router.push("/users")
                          }}
                        >
                          <UserCog className="h-4 w-4" />
                          {admin ? "Manage Team" : "Assign Admin"}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          loading={isUpdatingThisBranch}
                          className={cn(
                            "h-10 min-w-[112px] px-4 gap-2 rounded-xl border-slate-200 dark:border-slate-800 shadow-sm transition-all",
                            isActive
                              ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                              : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                          )}
                          disabled={!!updatingBranchId}
                          onClick={() => { void handleStatusToggle(branch.id, branch.status) }}
                        >
                          {isUpdatingThisBranch ? "Updating" : isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function StatCard({ label, value, icon, variant }: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode;
  variant: 'blue' | 'green' | 'red' | 'amber' | 'purple'
}) {
  const variants = {
    blue: "bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border-blue-100/50 text-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800/30 dark:text-blue-400",
    green: "bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border-emerald-100/50 text-emerald-700 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800/30 dark:text-emerald-400",
    red: "bg-gradient-to-br from-rose-50/80 to-red-50/80 border-rose-100/50 text-rose-700 dark:from-rose-900/20 dark:to-red-900/20 dark:border-rose-800/30 dark:text-rose-400",
    amber: "bg-gradient-to-br from-amber-50/80 to-orange-50/80 border-amber-100/50 text-amber-700 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800/30 dark:text-amber-400",
    purple: "bg-gradient-to-br from-purple-50/80 to-fuchsia-50/80 border-purple-100/50 text-purple-700 dark:from-purple-900/20 dark:to-fuchsia-900/20 dark:border-purple-800/30 dark:text-purple-400",
  }

  const iconBadge = {
    blue: "bg-white/80 text-blue-600 shadow-sm border border-blue-100 dark:bg-slate-800 dark:border-blue-800",
    green: "bg-white/80 text-emerald-600 shadow-sm border border-emerald-100 dark:bg-slate-800 dark:border-emerald-800",
    red: "bg-white/80 text-rose-600 shadow-sm border border-rose-100 dark:bg-slate-800 dark:border-rose-800",
    amber: "bg-white/80 text-amber-600 shadow-sm border border-amber-100 dark:bg-slate-800 dark:border-amber-800",
    purple: "bg-white/80 text-purple-600 shadow-sm border border-purple-100 dark:bg-slate-800 dark:border-purple-800",
  }

  return (
    <div className={cn("flex items-center justify-between p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md", variants[variant])}>
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">{label}</p>
        <p className="text-2xl font-black tracking-tight">{value}</p>
      </div>
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", iconBadge[variant])}>
        {icon}
      </div>
    </div>
  )
}
