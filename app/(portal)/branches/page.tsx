"use client"

import { useEffect, useMemo, useState } from "react"
import { useBranches, useUsers } from "@/lib/hooks/use-api"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Building2, Users, RefreshCcw, Search, Boxes, UserCog, Sparkles, Loader2, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react"
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
  const { data: branchesRes, isLoading, mutate: refetchBranches } = useBranches(organizationId || undefined)
  const { data: usersRes, mutate: refetchUsers } = useUsers(organizationId || undefined)

  const PAGE_SIZE = 20
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [page, setPage] = useState(1)
  const [updatingBranchId, setUpdatingBranchId] = useState<number | null>(null)

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

  const handleRefresh = () => {
    refetchBranches()
    refetchUsers()
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
    <main className="p-6 space-y-6">
      <section className="space-y-6">
        <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-indigo-900 to-indigo-700 text-white shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
          </div>
          <CardHeader className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                <Sparkles className="h-4 w-4" />
                Head Office
              </p>
              <CardTitle className="text-3xl font-semibold text-white">Branch intelligence overview</CardTitle>
              <p className="text-sm text-white/80">
                Watch live coverage, staffing, and health indicators for every branch under {organizationId ? `org ${organizationId}` : "your care"}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" className="gap-2" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCcw className="h-4 w-4" />
                Refresh data
              </Button>
              <div className="rounded-full bg-white/15 px-4 py-2 text-xs uppercase tracking-wide text-white">
                {totalBranches} branches • {coverage}% staffed
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Branches"
            value={totalBranches}
            description="Across your organization"
            accent="from-indigo-500 to-sky-500"
            icon={<Building2 className="h-5 w-5 text-indigo-600" />}
          />
          <SummaryCard
            title="Active Branches"
            value={activeBranches}
            description={`${inactiveBranches} inactive`}
            accent="from-emerald-500 to-lime-500"
            icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
          />
          <SummaryCard
            title="Admin Coverage"
            value={`${coverage}%`}
            description={`${branchesWithAdmins}/${totalBranches || 1} staffed`}
            accent="from-blue-500 to-cyan-500"
            icon={<Users className="h-5 w-5 text-blue-600" />}
          />
          <SummaryCard
            title="Needs Attention"
            value={inactiveBranches}
            description="Inactive or onboarding"
            accent="from-rose-500 to-orange-500"
            icon={<Badge variant="outline" className="text-rose-600 border-rose-200">Alert</Badge>}
          />
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl">Branch control center</CardTitle>
            <p className="text-sm text-muted-foreground">Search, filter, and act on any branch instantly.</p>
          </div>
          <div className="flex flex-col gap-3 w-full lg:flex-row lg:items-center lg:justify-end">
            <div className="relative w-full lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
              <SelectTrigger className="lg:w-48">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedBranches.map((branch) => {
                const admin = adminByBranch[String(branch.id)]
                const isActive = (branch.status || "active").toLowerCase() === "active"
                return (
                  <div
                    key={branch.id}
                    className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Branch</p>
                        <h3 className="text-lg font-semibold">{branch.name}</h3>
                      </div>
                      <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Code</span>
                        <span className="font-medium text-foreground">{branch.code || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Created</span>
                        <span className="font-medium text-foreground">
                          {branch.createdAt ? new Date(branch.createdAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Branch admin</p>
                      {admin ? (
                        <div className="mt-1">
                          <p className="font-medium">
                            {[admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.email}
                          </p>
                          <p className="text-xs text-muted-foreground">{admin.email}</p>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">No admin assigned</p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        variant={isActive ? "outline" : "default"}
                        size="sm"
                        className="gap-2"
                        onClick={() => handleStatusToggle(branch.id, branch.status)}
                        disabled={updatingBranchId === branch.id}
                      >
                        {updatingBranchId === branch.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="h-4 w-4" />
                        )}
                        Mark {isActive ? "Inactive" : "Active"}
                      </Button>
                      <Button asChild variant="secondary" size="sm" className="gap-2">
                        <Link href={`/inventory?branchId=${branch.id}`}>
                          <Boxes className="h-4 w-4" />
                          Inventory
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setBranchId(String(branch.id))
                          router.push("/users")
                        }}
                      >
                        <UserCog className="h-4 w-4" />
                        {admin ? "Manage team" : "Assign admin"}
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

function SummaryCard({
  title,
  value,
  description,
  icon,
  accent,
}: {
  title: string
  value: string | number
  description: string
  icon?: React.ReactNode
  accent?: string
}) {
  return (
    <Card className="border-none shadow-md">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl bg-muted",
              accent ? `bg-gradient-to-r ${accent} text-white` : ""
            )}
          >
            {icon}
          </div>
          <span className="font-medium text-foreground">{title}</span>
        </div>
        <div className="text-3xl font-semibold text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
