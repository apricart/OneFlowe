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

  const organizations = orgsData?.items || []
  const branches = branchesData?.items || []

  // Don't render until initialized
  if (!isInitialized) return null

  // Branch Admin: show read-only breadcrumb
  if (userRole === "BRANCH_ADMIN") {
    const org = organizations.find((o: any) => o.id.toString() === organizationId)
    const branch = branches.find((b: any) => b.id.toString() === branchId)

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/50 text-sm">
        {org && (
          <>
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{org.name}</span>
          </>
        )}
        {org && branch && <span className="text-muted-foreground">›</span>}
        {branch && (
          <>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{branch.name}</span>
          </>
        )}
      </div>
    )
  }

  // Super Admin & Head Office: show selectors
  const isOrgDisabled = userRole === "HEAD_OFFICE"
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
            disabled={isOrgDisabled}
          >
            <SelectTrigger className={`w-[200px] pl-9 ${isOrgDisabled ? "opacity-70 cursor-not-allowed" : ""}`}>
              <SelectValue>
                {orgsLoading ? "Loading..." : selectedOrg?.name || "All Organizations"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {userRole === "SUPER_ADMIN" && (
                  <SelectItem value="all">All Organizations</SelectItem>
                )}
                {organizations
                  .filter((org: any) => org.status === "active")
                  .map((org: any) => (
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

      {/* Reset Button (Super Admin only) */}
      {userRole === "SUPER_ADMIN" && (organizationId || branchId) && (
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

