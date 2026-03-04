"use client"

import { Building2, GitBranch, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAppContext } from "@/components/context/app-context"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function ContextSelector() {
  const {
    organizationId,
    branchId,
    branchIds,
    userRole,
    setOrganizationId,
    setBranchId,
    resetContext,
    isInitialized,
  } = useAppContext()

  // Fetch organizations
  const { data: orgsData, isLoading: orgsLoading } = useSWR(
    "/api/v1/organizations",
    fetcher
  )

  // Fetch branches (filtered by selected organization)
  const { data: branchesData, isLoading: branchesLoading } = useSWR(
    organizationId ? `/api/v1/branches?organizationId=${organizationId}` : null,
    fetcher
  )

  const organizations = (orgsData?.items || []).filter((org: any) => org.status === "active")
  const branches = (branchesData?.items || []).filter((branch: any) => branch.status === "active")

  // Don't render until initialized
  if (!isInitialized) return null

  // Branch Admin & Head Office: show read-only breadcrumb
  if (userRole === "BRANCH_ADMIN" || userRole === "HEAD_OFFICE") {
    const org = organizations.find((o: any) => o.id.toString() === organizationId)
    const branch = branches.find((b: any) => b.id.toString() === branchId)

    // Handle label for HO with multiple branches
    let branchLabel = "Global Overview"
    if (userRole === "BRANCH_ADMIN" && branch) {
      branchLabel = branch.name
    } else if (userRole === "HEAD_OFFICE") {
      if (branchIds.length > 1) {
        branchLabel = `${branchIds.length} Branches`
      } else if (branch) {
        branchLabel = branch.name
      } else if (branchIds.length === 1) {
        const singleBranch = branches.find((b: any) => b.id.toString() === branchIds[0])
        branchLabel = singleBranch?.name || "1 Branch"
      }
    }

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/50 text-xs animate-in fade-in duration-300">
        {org && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="font-bold text-slate-700 dark:text-slate-200">{org.name}</span>
          </div>
        )}
        {org && (
          <span className="text-slate-400 font-medium mx-1">/</span>
        )}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <GitBranch className={`h-4 w-4 ${(branch || branchIds.length > 0) ? "text-indigo-600" : "text-slate-400"}`} />
          <span className={`font-semibold truncate ${(branch || branchIds.length > 0) ? "text-slate-700 dark:text-slate-200" : "text-slate-500 italic"}`}>
            {branchLabel}
          </span>
        </div>
      </div>
    )
  }

  // Super Admin: show interactable selectors
  const selectedOrg = organizations.find((o: any) => o.id.toString() === organizationId)
  const selectedBranch = branches.find((b: any) => b.id.toString() === branchId)

  return (
    <div className="flex items-center gap-2">
      {/* Organization Selector */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <Select
            value={organizationId || "all"}
            onValueChange={(val) => setOrganizationId(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-[200px] pl-9">
              <SelectValue>
                {orgsLoading ? "Loading..." : selectedOrg?.name || "All Organizations"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org: any) => (
                  <SelectItem key={org.id} value={org.id.toString()}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Branch Selector */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <Select
            value={branchId || "all"}
            onValueChange={(val) => setBranchId(val === "all" ? null : val)}
            disabled={!organizationId}
          >
            <SelectTrigger className="w-[200px] pl-9">
              <SelectValue>
                {branchesLoading
                  ? "Loading..."
                  : !organizationId
                    ? "Select Organization"
                    : selectedBranch?.name || "All Branches"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reset Button */}
      {(organizationId || branchId) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={resetContext}
          title="Reset to global scope"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

