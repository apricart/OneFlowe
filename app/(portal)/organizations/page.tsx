"use client"
import { useOrganizations, useBranches } from "@/lib/hooks/use-api"
type Organization = { id: number; name: string; code: string; status?: "active" | "inactive" }
type Branch = { id: number; name: string; code: string; organizationId: number; status?: "active" | "inactive" }
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Building2, GitBranch, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { useAppContext } from "@/components/context/app-context"
import { PremiumConfirmDialog } from "@/components/premium/premium-confirm-dialog"
import { PremiumAlert, type AlertType } from "@/components/premium/premium-alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"

type OrgsRes = { items: Organization[] }
type BranchesRes = { items: Branch[] }


export default function OrganizationsPage() {
  const { data: orgs, mutate: refetchOrgs, isLoading: loadingOrgs } = useOrganizations()
  const { data: branches, mutate: refetchBranches } = useBranches()
  const { organizationId: contextOrgId } = useAppContext()

  const [openOrg, setOpenOrg] = useState(false)
  const [openBranch, setOpenBranch] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; type: AlertType; visible: boolean }>({
    message: "",
    type: "info",
    visible: false,
  })

  const showFeedback = (message: string, type: AlertType) => {
    setFeedback({ message, type, visible: true })
  }
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [orgSearch, setOrgSearch] = useState("")
  const [branchStatusFilter, setBranchStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null; name: string | null }>({
    open: false,
    id: null,
    name: null,
  })
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<{ open: boolean; id: string | null; name: string | null }>({
    open: false,
    id: null,
    name: null,
  })
  const [isDeleting, setIsDeleting] = useState(false)

  // Helper to add a new organization to the cache optimistically
  const addOrganizationOptimistic = async (newOrg: Organization) => {
    console.log("[OrganizationsPage] 🚀 Adding org optimistically:", newOrg)
    const currentOrgs = orgs?.items || []
    await refetchOrgs({ items: [newOrg, ...currentOrgs] }, { revalidate: true })
    console.log("[OrganizationsPage] ✅ Org added, revalidating in background")
  }

  // Helper to remove an organization from the cache optimistically
  const removeOrganizationOptimistic = async (id: string) => {
    console.log("[OrganizationsPage] 🚀 Removing org optimistically:", id)
    const currentOrgs = orgs?.items || []
    const updatedOrgs = currentOrgs.filter(o => String(o.id) !== String(id))
    await refetchOrgs({ items: updatedOrgs }, { revalidate: true })
    console.log("[OrganizationsPage] ✅ Org removed, revalidating in background")
  }

  // Helper to edit an organization in the cache optimistically
  const editOrganizationOptimistic = async (id: string, payload: Partial<Organization>) => {
    console.log("[OrganizationsPage] 🚀 Editing org optimistically:", id, payload)
    const currentOrgs = orgs?.items || []
    const updatedOrgs = currentOrgs.map(o => String(o.id) === String(id) ? { ...o, ...payload } : o)
    await refetchOrgs({ items: updatedOrgs }, { revalidate: true })
    console.log("[OrganizationsPage] ✅ Org edited, revalidating in background")
  }

  // Helper to add a new branch to the cache optimistically
  const addBranchOptimistic = async (newBranch: Branch) => {
    console.log("[OrganizationsPage] 🚀 Adding branch optimistically:", newBranch)
    const currentBranches = branches?.items || []
    await refetchBranches({ items: [newBranch, ...currentBranches] }, { revalidate: true })
    console.log("[OrganizationsPage] ✅ Branch added, revalidating in background")
  }

  // Helper to remove a branch from the cache optimistically
  const removeBranchOptimistic = async (id: string) => {
    console.log("[OrganizationsPage] 🚀 Removing branch optimistically:", id)
    const currentBranches = branches?.items || []
    const updatedBranches = currentBranches.filter(b => String(b.id) !== String(id))
    await refetchBranches({ items: updatedBranches }, { revalidate: true })
    console.log("[OrganizationsPage] ✅ Branch removed, revalidating in background")
  }

  // Helper to edit a branch in the cache optimistically
  const editBranchOptimistic = async (id: string, payload: Partial<Branch>) => {
    console.log("[OrganizationsPage] 🚀 Editing branch optimistically:", id, payload)
    const currentBranches = branches?.items || []
    const updatedBranches = currentBranches.map(b => String(b.id) === String(id) ? { ...b, ...payload } : b)
    await refetchBranches({ items: updatedBranches }, { revalidate: true })
    console.log("[OrganizationsPage] ✅ Branch edited, revalidating in background")
  }

  // Combined refresh helper
  const refreshAll = async () => {
    console.log("[OrganizationsPage] 🔄 Triggering full refresh...")
    console.log("[OrganizationsPage] Current orgs count:", orgs?.items?.length)
    console.log("[OrganizationsPage] Current branches count:", branches?.items?.length)

    // Trigger revalidation
    await Promise.all([
      refetchOrgs(),
      refetchBranches()
    ])

    console.log("[OrganizationsPage] ✅ Refresh complete")
    console.log("[OrganizationsPage] New orgs count:", orgs?.items?.length)
    console.log("[OrganizationsPage] New branches count:", branches?.items?.length)
  }

  useEffect(() => {
    if (contextOrgId) {
      setSelectedOrgId(contextOrgId)
    } else if (!selectedOrgId && (orgs?.items?.length || 0) > 0) {
      setSelectedOrgId(String(orgs!.items[0].id))
    }
  }, [contextOrgId, orgs?.items, selectedOrgId])

  async function removeOrganization(id: string) {
    try {
      setIsDeleting(true)
      const res = await fetch(`/api/v1/organizations/${id}`, { method: "DELETE" })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 404) {
          // If already deleted, just sync UI
          await removeOrganizationOptimistic(id)
          showFeedback("Organization already deleted. Syncing state.", "success")
          return
        }
        throw new Error(data.error || "Failed to delete organization")
      }

      showFeedback("Organization deleted successfully.", "success")
      await removeOrganizationOptimistic(id)
    } catch (e: any) {
      showFeedback(e.message, "error")
      await refreshAll() // Rollback/Restore on error
    } finally {
      setIsDeleting(false)
      setConfirmDelete({ open: false, id: null, name: null })
    }
  }

  async function removeBranch(id: string) {
    try {
      setIsDeleting(true)
      const res = await fetch(`/api/v1/branches/${id}`, { method: "DELETE" })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 404) {
          // If already deleted, just sync UI
          await removeBranchOptimistic(id)
          showFeedback("Branch already deleted. Syncing state.", "success")
          return
        }
        throw new Error(data.error || "Failed to delete branch")
      }

      showFeedback("Branch deleted successfully.", "success")
      await removeBranchOptimistic(id)
    } catch (e: any) {
      showFeedback(e.message, "error")
      await refreshAll() // Rollback/Restore on error
    } finally {
      setIsDeleting(false)
      setConfirmDeleteBranch({ open: false, id: null, name: null })
    }
  }

  async function editOrganization(id: string, payload: Partial<Organization>) {
    try {
      const res = await fetch(`/api/v1/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update organization")
      showFeedback("Organization updated successfully.", "success")
      await editOrganizationOptimistic(id, payload)
    } catch (e: any) {
      showFeedback(e.message, "error")
      await refreshAll() // Rollback on error
    }
  }

  const filteredOrganizations = useMemo(() => {
    if (!orgs?.items) return []
    if (!orgSearch.trim()) return orgs.items
    const query = orgSearch.toLowerCase()
    return orgs.items.filter((org) => org.name.toLowerCase().includes(query) || org.code.toLowerCase().includes(query))
  }, [orgs?.items, orgSearch])

  const branchesByOrgId = useMemo(() => {
    const map = new Map<number, Branch[]>()
    if (branches?.items) {
      branches.items.forEach((branch) => {
        const list = map.get(branch.organizationId) || []
        list.push(branch)
        map.set(branch.organizationId, list)
      })
    }
    return map
  }, [branches?.items])

  const selectedOrg = selectedOrgId ? orgs?.items?.find((org) => String(org.id) === String(selectedOrgId)) : null
  const visibleBranches = useMemo(() => {
    if (!branches?.items) return []
    if (!selectedOrgId) return branches.items
    return branches.items.filter((branch) => String(branch.organizationId) === String(selectedOrgId))
  }, [branches?.items, selectedOrgId])

  const filteredBranches = useMemo(() => {
    if (branchStatusFilter === "all") return visibleBranches
    return visibleBranches.filter((branch) =>
      branchStatusFilter === "active" ? isActiveStatus(branch.status) : !isActiveStatus(branch.status)
    )
  }, [visibleBranches, branchStatusFilter])

  const orgCount = orgs?.items.length ?? 0
  const branchCount = branches?.items.length ?? 0

  return (
    <>
      <PremiumAlert
        message={feedback.message}
        type={feedback.type}
        isVisible={feedback.visible}
        onClose={() => setFeedback({ ...feedback, visible: false })}
      />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className={cn("text-2xl font-semibold text-balance")}>Companies</h1>
          <div className="flex gap-2">
            <CreateOrgDialog
              open={openOrg}
              onOpenChange={setOpenOrg}
              showFeedback={showFeedback}
              onCreated={async (newOrg) => {
                setOpenOrg(false)
                await addOrganizationOptimistic(newOrg)
              }}
            />
            <CreateBranchDialog
              organizations={orgs?.items || []}
              open={openBranch}
              onOpenChange={setOpenBranch}
              showFeedback={showFeedback}
              onCreated={async (newBranch) => {
                setOpenBranch(false)
                await addBranchOptimistic(newBranch)
              }}
            />
          </div>
        </header>

        <section className="grid gap-4">
          <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-indigo-900 to-indigo-700 text-white shadow-xl">
            <div className="pointer-events-none absolute inset-0 opacity-30">
              <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
            </div>
            <CardHeader className="relative space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Organization overview</p>
                <CardTitle className="text-3xl font-semibold text-white">Multi-tenant control center</CardTitle>
                <p className="text-sm text-white/80">
                  Keep every company and its branch network aligned. Use this panel to manage hierarchy, status, and growth.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <HeroStat label="Companies" value={orgCount} helper="Active tenants" />
                <HeroStat label="Branches" value={branchCount} helper="Across all orgs" />
                <HeroStat label="Average branches/org" value={orgCount ? Math.max(1, Math.round(branchCount / orgCount)) : 0} helper="Coverage" />
              </div>
            </CardHeader>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <Card className="h-full border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Company List
                <Badge variant="outline">{orgCount}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">Select a company to view its details and branches.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[calc(100vh-280px)] pr-3">
                <div className="space-y-2">
                  <OrganizationListItem
                    isActive={!selectedOrgId}
                    onClick={() => setSelectedOrgId(null)}
                    title="All Companies"
                    subtitle={`${orgCount} companies, ${branchCount} branches`}
                    badgeLabel="Global"
                  />
                  {filteredOrganizations.map((org) => (
                    <OrganizationListItem
                      key={org.id}
                      isActive={String(org.id) === String(selectedOrgId)}
                      onClick={() => setSelectedOrgId(String(org.id))}
                      title={org.name}
                      subtitle={`${org.code} • ${branchesByOrgId.get(org.id)?.length || 0} branches`}
                      status={isActiveStatus(org.status)}
                    >
                      <EditOrgDialog org={org} onSave={(payload) => editOrganization(String(org.id), payload)} />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation()
                          setConfirmDelete({ open: true, id: String(org.id), name: org.name })
                        }}
                        title="Delete company"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </OrganizationListItem>
                  ))}
                  {filteredOrganizations.length === 0 && (
                    <p className="text-sm text-muted-foreground px-2">No companies match your search.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{selectedOrg ? selectedOrg.name : "All Companies"}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrg
                      ? `Code ${selectedOrg.code} • ${branchesByOrgId.get(selectedOrg.id)?.length || 0} branch(es)`
                      : "Showing metrics across every company"}
                  </p>
                </div>
                {selectedOrg && (
                  <div className="flex items-center gap-2">
                    <EditOrgDialog org={selectedOrg} onSave={(payload) => editOrganization(String(selectedOrg.id), payload)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete({ open: true, id: String(selectedOrg.id), name: selectedOrg.name })}
                      title="Delete company"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryStat
                    label={selectedOrg ? "Current company" : "Companies"}
                    value={selectedOrg ? selectedOrg.name : orgCount}
                    helper={selectedOrg ? `Code ${selectedOrg.code}` : "Total tenants"}
                    icon={<Building2 className="h-4 w-4 text-primary" />}
                  />
                  <SummaryStat
                    label="Branches in view"
                    value={filteredBranches.length}
                    helper={branchStatusFilter === "all" ? "All statuses" : `${branchStatusFilter} only`}
                    icon={<GitBranch className="h-4 w-4 text-emerald-500" />}
                  />
                  <SummaryStat
                    label="Status"
                    value={
                      selectedOrg ? (isActiveStatus(selectedOrg.status) ? "Active" : "Inactive") : `${branchCount} branches total`
                    }
                    helper={selectedOrg ? "Company visibility" : "Across all orgs"}
                    icon={<Badge variant="outline">{selectedOrg ? "Org" : "All"}</Badge>}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Branches {selectedOrg ? `for ${selectedOrg.name}` : ""}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {filteredBranches.length} branch{filteredBranches.length === 1 ? "" : "es"} shown
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Select value={branchStatusFilter} onValueChange={(value) => setBranchStatusFilter(value as typeof branchStatusFilter)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="inactive">Inactive only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <BranchesTable
                  items={filteredBranches}
                  organizations={orgs?.items || []}
                  showCompanyColumn={!selectedOrg}
                  showFeedback={showFeedback}
                  onDelete={(id, name) => setConfirmDeleteBranch({ open: true, id, name })}
                  onRefresh={refreshAll}
                  onEdit={editBranchOptimistic}
                />
              </CardContent>
            </Card>
          </div>
        </section>


        {loadingOrgs && <div className="text-sm text-muted-foreground">Loading...</div>}

        <PremiumConfirmDialog
          open={confirmDelete.open}
          onOpenChange={(open) => setConfirmDelete((prev) => ({ ...prev, open }))}
          onConfirm={() => confirmDelete.id && removeOrganization(confirmDelete.id)}
          title={`Delete "${confirmDelete.name}"?`}
          description="This action cannot be undone. All data related to this organization must be removed first."
          confirmText="Delete Company"
          type="danger"
          isLoading={isDeleting}
        />

        <PremiumConfirmDialog
          open={confirmDeleteBranch.open}
          onOpenChange={(open) => setConfirmDeleteBranch((prev) => ({ ...prev, open }))}
          onConfirm={() => confirmDeleteBranch.id && removeBranch(confirmDeleteBranch.id)}
          title={`Delete Branch "${confirmDeleteBranch.name}"?`}
          description="This action cannot be undone. Branch inventory, orders, and staff records will be permanently removed."
          confirmText="Delete Branch"
          type="danger"
          isLoading={isDeleting}
        />
      </main>
    </>
  )
}

function isActiveStatus(status: unknown): boolean {
  if (typeof status === "string") return status.toLowerCase().trim() === "active"
  if (typeof status === "number") return status === 1
  return Boolean(status)
}


function BranchesTable({
  items,
  organizations,
  showCompanyColumn = true,
  showFeedback,
  onDelete,
  onRefresh,
  onEdit,
}: {
  items: Branch[]
  organizations: Organization[]
  showCompanyColumn?: boolean
  showFeedback: (msg: string, type: AlertType) => void
  onDelete: (id: string, name: string) => void
  onRefresh: () => Promise<void>
  onEdit: (id: string, payload: Partial<Branch>) => Promise<void>
}) {
  const orgById = useMemo(() => Object.fromEntries(organizations.map((o) => [o.id, o])), [organizations])

  async function edit(id: string, payload: Partial<Branch>) {
    try {
      const res = await fetch(`/api/v1/branches/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      })
      if (!res.ok) throw new Error("Failed to update branch")
      showFeedback("Branch updated successfully.", "success")
      await onEdit(id, payload)
    } catch (e: any) {
      showFeedback(e.message, "error")
      await onRefresh() // Rollback on error
    }
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left border-b">
          <tr>
            <th className="py-2 pr-2">Branch</th>
            <th className="py-2 pr-2">Code</th>
            {showCompanyColumn && <th className="py-2 pr-2">Company</th>}
            <th className="py-2 pr-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} className="border-b last:border-0">
              <td className="py-2 pr-2">{b.name}</td>
              <td className="py-2 pr-2">{b.code}</td>
              {showCompanyColumn && <td className="py-2 pr-2">{orgById[b.organizationId]?.name || "—"}</td>}
              <td className="py-2 pr-2">
                <Badge
                  variant={isActiveStatus(b.status) ? "outline" : "destructive"}
                  className={cn(
                    "px-2 py-0.5 text-xs",
                    isActiveStatus(b.status) ? "border-emerald-200 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                  )}
                >
                  {isActiveStatus(b.status) ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="py-2 text-right">
                <div className="inline-flex items-center gap-1">
                  <EditBranchDialog branch={b} onSave={(payload) => edit(String(b.id), payload)} />
                  <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => onDelete(String(b.id), b.name)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="py-3 text-muted-foreground" colSpan={showCompanyColumn ? 5 : 4}>
                No branches match the current view.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function OrganizationListItem({
  title,
  subtitle,
  onClick,
  isActive,
  children,
  status,
  badgeLabel,
}: {
  title: string
  subtitle: string
  onClick: () => void
  isActive: boolean
  children?: ReactNode
  status?: boolean
  badgeLabel?: string
}) {
  const initials = title
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      suppressHydrationWarning
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "w-full rounded-lg border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
            isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {badgeLabel === "Global" ? "∞" : initials || "?"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{title}</p>
            {typeof status === "boolean" && (
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  status ? "bg-emerald-400" : "bg-rose-400"
                )}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          {typeof status === "boolean" ? (
            <Badge variant={status ? "outline" : "destructive"}>{status ? "Active" : "Inactive"}</Badge>
          ) : badgeLabel ? (
            <Badge variant="secondary">{badgeLabel}</Badge>
          ) : null}
          {children && (
            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HeroStat({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {helper && <p className="text-xs text-white/70">{helper}</p>}
    </div>
  )
}

function SummaryStat({ label, value, icon, helper }: { label: string; value: string | number; icon?: ReactNode; helper?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
  showFeedback,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (item: Organization) => void
  showFeedback: (msg: string, type: AlertType) => void
}) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [status, setStatus] = useState<boolean>(true)
  async function submit() {
    try {
      const res = await fetch("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify({ name, code, status: status ? "active" : "inactive" }),
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create company")

      showFeedback("Company created successfully.", "success")
      setName("")
      setCode("")
      setStatus(true)
      onCreated(data.item)
    } catch (e: any) {
      showFeedback(e.message, "error")
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Building2 className="h-4 w-4" />
          Create Company
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Company</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Set up a new tenant with a memorable code and status. These values sync everywhere in the portal.
          </p>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Company name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ACME"
                />
                <p className="text-xs text-muted-foreground">Short & unique ID used in reports and APIs.</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <Label htmlFor="org-status">Status</Label>
                <p className="text-xs text-muted-foreground">Inactive companies remain hidden from assignments.</p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="org-status"
                  checked={status}
                  onCheckedChange={(v: boolean | "indeterminate") => setStatus(Boolean(v))}
                />
                <Badge variant={status ? "default" : "outline"}>{status ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} className="gap-2" disabled={!name || !code}>
            <Save className="h-4 w-4" />
            Save Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateBranchDialog({
  organizations,
  open,
  onOpenChange,
  onCreated,
  showFeedback,
}: {
  organizations: Organization[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (item: Branch) => void
  showFeedback: (msg: string, type: AlertType) => void
}) {
  const [orgId, setOrgId] = useState<string | undefined>(undefined)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [status, setStatus] = useState<boolean>(true)
  async function submit() {
    if (!orgId) return
    console.log("[CreateBranchDialog] 📝 Submitting new branch:", { orgId, name, code, status })

    try {
      const res = await fetch("/api/v1/branches", {
        method: "POST",
        body: JSON.stringify({ organizationId: orgId, name, code, status: status ? "active" : "inactive" }),
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()

      console.log("[CreateBranchDialog] 📡 API Response:", { ok: res.ok, status: res.status, data })

      if (!res.ok) throw new Error(data.error || "Failed to create branch")

      showFeedback("Branch created successfully.", "success")
      setName("")
      setCode("")
      setStatus(true)
      setOrgId(undefined)

      console.log("[CreateBranchDialog] 🔄 Calling onCreated to trigger refresh...")
      onCreated(data.item)
      console.log("[CreateBranchDialog] ✅ onCreated called")
    } catch (e: any) {
      console.error("[CreateBranchDialog] ❌ Error:", e.message)
      showFeedback(e.message, "error")
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 border-none">
          <GitBranch className="h-4 w-4" />
          Create Branch
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Branch</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Branches inherit organization settings and determine branch-admin visibility.
          </p>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={orgId} onValueChange={(v: string) => setOrgId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations
                      .map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bname">Branch name</Label>
                  <Input
                    id="bname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Downtown Branch"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bcode">Code</Label>
                  <Input
                    id="bcode"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="DT-01"
                  />
                  <p className="text-xs text-muted-foreground">Visible in budgets, inventory, and reports.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <Label htmlFor="branch-status">Status</Label>
                <p className="text-xs text-muted-foreground">Deactivate to temporarily hide the branch.</p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="branch-status"
                  checked={status}
                  onCheckedChange={(v: boolean | "indeterminate") => setStatus(Boolean(v))}
                />
                <Badge variant={status ? "default" : "outline"}>{status ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!orgId || !name || !code} className="gap-2">
            <Save className="h-4 w-4" />
            Save Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditOrgDialog({ org, onSave }: { org: Organization; onSave: (payload: Partial<Organization>) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(org.name)
  const [code, setCode] = useState(org.code)
  const [status, setStatus] = useState<boolean>(isActiveStatus(org.status))

  useEffect(() => {
    setName(org.name)
    setCode(org.code)
    setStatus(isActiveStatus(org.status))
  }, [org.name, org.code, org.status])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit">
          <Pencil size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
          <p className="text-sm text-muted-foreground">Update company metadata. Changes sync immediately.</p>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ename">Company name</Label>
                <Input id="ename" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ecode">Code</Label>
                <Input id="ecode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <Label htmlFor="org-status-edit">Status</Label>
                <p className="text-xs text-muted-foreground">Inactive orgs keep their data but hide from selectors.</p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="org-status-edit"
                  checked={status}
                  onCheckedChange={(v: boolean | "indeterminate") => setStatus(Boolean(v))}
                />
                <Badge variant={status ? "default" : "outline"}>{status ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="gap-2"
            onClick={() => {
              onSave({ name, code, status: status ? "active" : "inactive" })
              setOpen(false)
            }}
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditBranchDialog({ branch, onSave }: { branch: Branch; onSave: (payload: Partial<Branch>) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(branch.name)
  const [code, setCode] = useState(branch.code)
  const [status, setStatus] = useState<boolean>(isActiveStatus(branch.status))

  useEffect(() => {
    setName(branch.name)
    setCode(branch.code)
    setStatus(isActiveStatus(branch.status))
  }, [branch.name, branch.code, branch.status])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit branch">
          <Pencil size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Branch</DialogTitle>
          <p className="text-sm text-muted-foreground">Keep branch naming clean for orders and budgets.</p>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bname-edit">Branch name</Label>
                <Input id="bname-edit" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bcode-edit">Code</Label>
                <Input id="bcode-edit" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <Label htmlFor="branch-status-edit">Status</Label>
                <p className="text-xs text-muted-foreground">Inactive branches stay archived for reference.</p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="branch-status-edit"
                  checked={status}
                  onCheckedChange={(v: boolean | "indeterminate") => setStatus(Boolean(v))}
                />
                <Badge variant={status ? "default" : "outline"}>{status ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="gap-2"
            onClick={() => {
              onSave({ name, code, status: status ? "active" : "inactive" })
              setOpen(false)
            }}
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
