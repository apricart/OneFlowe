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
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50/50 dark:bg-slate-950 p-4 md:p-8 space-y-6">
        {/* Compact Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 md:p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-100 to-emerald-100 dark:from-indigo-900/50 dark:to-emerald-900/50 flex items-center justify-center border border-indigo-50/50 dark:border-indigo-800/50 shadow-inner">
              <Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Organization Settings</h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Manage companies &amp; branches</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CreateOrgDialog
              open={openOrg}
              onOpenChange={setOpenOrg}
              showFeedback={showFeedback}
              variant="outline"
              className="h-9 gap-2 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 shadow-sm"
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
              variant="default"
              className="h-9 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              onCreated={async (newBranch) => {
                setOpenBranch(false)
                await addBranchOptimistic(newBranch)
              }}
            />
          </div>
        </div>

        {/* Compact Colorful Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <CompactStatCard
            label="Companies"
            value={orgCount}
            icon={<Building2 className="h-5 w-5" />}
            gradient="bg-gradient-to-br from-indigo-50/80 to-blue-50/80 border-indigo-100/50 text-indigo-700 dark:from-indigo-900/20 dark:to-blue-900/20 dark:border-indigo-800/30 dark:text-indigo-400"
            iconBadge="bg-white/80 text-indigo-600 shadow-sm border border-indigo-100 dark:bg-slate-800 dark:border-indigo-800"
          />
          <CompactStatCard
            label="Branches"
            value={branchCount}
            icon={<GitBranch className="h-5 w-5" />}
            gradient="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border-emerald-100/50 text-emerald-700 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800/30 dark:text-emerald-400"
            iconBadge="bg-white/80 text-emerald-600 shadow-sm border border-emerald-100 dark:bg-slate-800 dark:border-emerald-800"
          />
        </div>

        <section className="grid gap-10 lg:grid-cols-12 shrink-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
          <div className="lg:col-span-6 xl:col-span-5">
            <Card className="h-full border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-xl font-semibold tracking-tight">Company List</CardTitle>
                  <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 rounded-lg px-2.5 py-1">
                    {orgCount}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Select a company to view its details and branches.</p>
              </CardHeader>
              <CardContent className="space-y-6 px-4 pb-6">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                  <Input
                    placeholder="Search companies..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="pl-11 h-12 bg-slate-50/50 dark:bg-slate-950/50 border-transparent focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all"
                  />
                </div>
                <ScrollArea className="h-[500px] xl:h-[600px] -mx-4 px-4 pr-6">
                  <div className="space-y-3">
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
                          className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg"
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
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">No results found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-6 xl:col-span-7 space-y-10">
            <div className="grid gap-6 sm:grid-cols-2">
              <SummaryStat
                label={selectedOrg ? "Parent Identity" : "Infrastructure"}
                value={selectedOrg ? selectedOrg.name : `${orgCount} Entities`}
                helper={selectedOrg ? `ID: ${selectedOrg.code}` : "Active Tenants"}
                icon={<Building2 className="h-5 w-5" />}
              />
              <SummaryStat
                label="Operational Reach"
                value={`${filteredBranches.length} Branch${filteredBranches.length === 1 ? "" : "es"}`}
                helper={branchStatusFilter === "all" ? "Full Distribution" : `${branchStatusFilter} Subset`}
                icon={<GitBranch className="h-5 w-5" />}
              />
            </div>

            <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] overflow-hidden">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-bold tracking-tight">Branches Management</CardTitle>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {selectedOrg ? `Strategic units for ${selectedOrg.name}` : `Full enterprise distribution`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 items-center px-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Filter by status
                  </div>
                  <Select value={branchStatusFilter} onValueChange={(value) => setBranchStatusFilter(value as typeof branchStatusFilter)}>
                    <SelectTrigger className="w-[180px] h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-sm focus:ring-4 focus:ring-indigo-500/10 transition-all">
                      <SelectValue placeholder="Status Distribution" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="inactive">Inactive only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px] xl:h-[550px] w-full">
                  <div className="w-full px-8 pb-8 pt-2">
                    <BranchesTable
                      items={filteredBranches}
                      organizations={orgs?.items || []}
                      showCompanyColumn={!selectedOrg}
                      showFeedback={showFeedback}
                      onDelete={(id, name) => setConfirmDeleteBranch({ open: true, id, name })}
                      onRefresh={refreshAll}
                      onEdit={editBranchOptimistic}
                    />
                  </div>
                </ScrollArea>
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
          description={selectedOrg?.status === "active"
            ? "This action cannot be undone. Active organizations with branches or users cannot be deleted directly. Please deactivate the organization first to allow automatic cleanup."
            : "This action cannot be undone. Deleting this inactive organization will automatically remove its associated branches, users, and non-financial data."}
          confirmText="Delete Company"
          type="danger"
          isLoading={isDeleting}
        />

        <PremiumConfirmDialog
          open={confirmDeleteBranch.open}
          onOpenChange={(open) => setConfirmDeleteBranch((prev) => ({ ...prev, open }))}
          onConfirm={() => confirmDeleteBranch.id && removeBranch(confirmDeleteBranch.id)}
          title={`Delete Branch "${confirmDeleteBranch.name}"?`}
          description="This action cannot be undone. Branch inventory, orders, and staff records will be permanently removed. If the branch is active, ensure all users are reassigned first."
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
    <div className="w-full">
      <table className="w-full text-sm border-collapse table-fixed">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800/60">
            <th className="pb-4 pr-2 font-semibold w-[35%]">Strategic Branch</th>
            <th className="pb-4 pr-2 font-semibold w-[15%]">Code</th>
            {showCompanyColumn && <th className="pb-4 pr-2 font-semibold w-[25%]">Parent</th>}
            <th className="pb-4 pr-2 font-semibold w-[15%] text-center">Lifecycle</th>
            <th className="pb-4 w-[10%]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
          {items.map((b) => (
            <tr key={b.id} className="group hover:bg-slate-50/80 dark:hover:bg-indigo-500/[0.03] transition-all duration-300">
              <td className="py-5 pr-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-100/50 dark:border-indigo-500/20 group-hover:scale-110 transition-transform">
                    {b.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tracking-tight">{b.name}</span>
                </div>
              </td>
              <td className="py-5 pr-4">
                <code className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest border border-slate-200/50 dark:border-slate-700/50">
                  {b.code}
                </code>
              </td>
              {showCompanyColumn && (
                <td className="py-5 pr-4">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{orgById[b.organizationId]?.name || "—"}</span>
                </td>
              )}
              <td className="py-5 pr-2 text-center">
                <Badge
                  variant={isActiveStatus(b.status) ? "outline" : "destructive"}
                  className={cn(
                    "px-2 py-0.5 text-[8px] uppercase font-semibold tracking-widest rounded-full border",
                    isActiveStatus(b.status)
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-500"
                      : "border-rose-500/20 bg-rose-500/5 text-rose-500"
                  )}
                >
                  {isActiveStatus(b.status) ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="py-5 text-right">
                <div className="inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all">
                  <EditBranchDialog branch={b} onSave={(payload) => edit(String(b.id), payload)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    onClick={() => onDelete(String(b.id), b.name)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="py-12 text-center" colSpan={showCompanyColumn ? 5 : 4}>
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                    <GitBranch className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-400">No operational units detected</p>
                </div>
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
        if (
          event.target instanceof HTMLElement &&
          (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.tagName === "BUTTON")
        ) {
          return
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "group w-full rounded-[1.25rem] border-2 p-4 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20",
        isActive
          ? "border-indigo-500/30 bg-indigo-50 shadow-[0_4px_20px_rgba(79,70,229,0.08)] dark:border-indigo-500/40 dark:bg-indigo-500/10"
          : "border-transparent bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/40 dark:bg-slate-950/40 dark:hover:bg-slate-800/60 dark:hover:border-slate-700 dark:hover:shadow-none"
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[13px] font-semibold transition-all duration-500",
            isActive
              ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 scale-110 rotate-3"
              : badgeLabel === "Global"
                ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                : "bg-white text-slate-600 border border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 group-hover:scale-105"
          )}
        >
          {badgeLabel === "Global" ? "∞" : initials || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={cn("font-semibold truncate tracking-tight", isActive ? "text-indigo-950 dark:text-indigo-100" : "text-slate-700 dark:text-slate-200")}>{title}</p>
            {typeof status === "boolean" && (
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  status ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                )}
              />
            )}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {typeof status === "boolean" ? (
            <Badge variant={status ? "outline" : "secondary"} className={cn(
              "text-[9px] uppercase font-semibold tracking-widest px-2 py-0.5 rounded-md",
              status
                ? "border-emerald-200/50 bg-emerald-50/50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400"
            )}>
              {status ? "Active" : "Inactive"}
            </Badge>
          ) : badgeLabel ? (
            <Badge variant="secondary" className="text-[9px] uppercase font-semibold tracking-widest px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-md border-transparent shadow-none">
              {badgeLabel}
            </Badge>
          ) : null}
          {children && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" onClick={(event) => event.stopPropagation()}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HeroStat({ label, value, helper, icon }: { label: string; value: string | number; helper?: string; icon?: ReactNode }) {
  return (
    <div className="min-w-[180px] rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-white/[0.08] hover:border-white/20 group">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500">
            {icon}
          </div>
          <p className="text-3xl font-semibold text-white tracking-tighter">{value}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-white uppercase tracking-[0.2em]">{label}</p>
          {helper && <p className="mt-1 text-[10px] text-white/50 font-medium uppercase tracking-widest">{helper}</p>}
        </div>
      </div>
    </div>
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

function SummaryStat({ label, value, icon, helper }: { label: string; value: string | number; icon?: ReactNode; helper?: string }) {
  return (
    <div className="relative overflow-hidden group flex flex-col justify-between rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white dark:bg-slate-950 p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-500/20">
      <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity translate-x-1/4 -translate-y-1/4">
        <div className="scale-[3]">
          {icon}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 shadow-sm transition-transform group-hover:scale-110">
            {icon}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</span>
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white truncate">
            {value}
          </div>
          {helper && <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400/80 uppercase tracking-wider">{helper}</p>}
        </div>
      </div>
    </div>
  )
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
  showFeedback,
  variant,
  className,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (item: Organization) => void
  showFeedback: (msg: string, type: AlertType) => void
  variant?: React.ComponentProps<typeof Button>["variant"]
  className?: string
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
        <Button variant={variant} className={cn("gap-2", className)}>
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
  variant,
  className,
}: {
  organizations: Organization[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (item: Branch) => void
  showFeedback: (msg: string, type: AlertType) => void
  variant?: React.ComponentProps<typeof Button>["variant"]
  className?: string
}) {
  const [orgId, setOrgId] = useState<string | undefined>(undefined)
  const [name, setName] = useState("")
  const [status, setStatus] = useState<boolean>(true)
  async function submit() {
    if (!orgId) return
    console.log("[CreateBranchDialog] 📝 Submitting new branch:", { orgId, name, status })

    try {
      const res = await fetch("/api/v1/branches", {
        method: "POST",
        body: JSON.stringify({ organizationId: orgId, name, status: status ? "active" : "inactive" }),
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()

      console.log("[CreateBranchDialog] 📡 API Response:", { ok: res.ok, status: res.status, data })

      if (!res.ok) throw new Error(data.error || "Failed to create branch")

      showFeedback("Branch created successfully.", "success")
      setName("")
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
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bname">Branch name</Label>
                  <Input
                    id="bname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Downtown Branch"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Branch code will be automatically generated.</p>
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
          <Button onClick={submit} disabled={!orgId || !name} className="gap-2">
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
                <Input id="bcode-edit" value={code} disabled className="bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground italic">Branch codes are non-editable.</p>
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
              onSave({ name, status: status ? "active" : "inactive" })
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
