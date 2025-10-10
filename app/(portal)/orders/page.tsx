"use client"
import { useState } from "react"
import { useOrders, useBranches, useOrganizations } from "@/lib/hooks/use-api"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useOrgBranch } from "@/components/context/org-branch-context"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const statuses = ["PENDING", "APPROVED", "REJECTED", "FULFILLED"] as const

export default function OrdersPage() {
  const { organizationId: globalOrgId, branchId: globalBranchId } = useOrgBranch()
  const [status, setStatus] = useState<string>("")
  // local overrides default to global context
  const [organizationId, setOrganizationId] = useState<string>(globalOrgId || "")
  const [branchId, setBranchId] = useState<string>(globalBranchId || "")
  const { data, isLoading, mutate } = useOrders({
    status,
    branchId: branchId || undefined,
    organizationId: organizationId || undefined,
  })
  const [selected, setSelected] = useState<any | null>(null)

  const { data: orgRes } = useOrganizations()
  const orgs = orgRes?.items || []
  const { data: branchRes } = useBranches(organizationId || undefined)
  const branches = branchRes?.items || []

  // confirm when changing local context
  const [pending, setPending] = useState<{ org?: string; branch?: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  function requestChange(next: { org?: string; branch?: string }) {
    setPending(next)
    setConfirmOpen(true)
  }
  function applyChange() {
    if (pending?.org !== undefined) setOrganizationId(pending.org || "")
    if (pending?.branch !== undefined) setBranchId(pending.branch || "")
    setConfirmOpen(false)
    mutate()
  }

  const items = data?.items || []
  const hasItems = items.length > 0

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-5">
        <Input placeholder="Select Dates" readOnly />

        {/* Organization filter */}
        <Select
          value={organizationId || globalOrgId || undefined}
          onValueChange={(val) => requestChange({ org: val === "__ALL_ORGS__" ? "" : val })}
        >
          <SelectTrigger>
            <SelectValue placeholder={globalOrgId ? "Use Global Org" : "All Organizations"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__ALL_ORGS__">All Organizations</SelectItem>
              {orgs.map((o: any) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Branch filter */}
        <Select
          value={branchId || globalBranchId || undefined}
          onValueChange={(val) => requestChange({ branch: val === "__ALL_BRANCHES__" ? "" : val })}
          disabled={!(organizationId || globalOrgId)}
        >
          <SelectTrigger>
            <SelectValue placeholder={organizationId || globalOrgId ? "All Branches" : "Pick org first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__ALL_BRANCHES__">
                {organizationId || globalOrgId ? "All Branches" : "Pick org first"}
              </SelectItem>
              {branches.map((b: any) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={status || undefined} onValueChange={(val) => setStatus(val)}>
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button onClick={() => mutate()} disabled={isLoading}>
          {isLoading ? "Filtering..." : "Filter"}
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-12 gap-2 p-4 text-xs font-medium opacity-60">
          <div className="col-span-3">Branch</div>
          <div className="col-span-2">Order Count</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Grand Total</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        {!hasItems && (
          <div className="p-12 text-center text-sm text-muted-foreground">No Records Found For This Month</div>
        )}
        {items.map((o: any) => (
          <div key={o.id} className="grid grid-cols-12 gap-2 p-4 border-t">
            <div className="col-span-3">{o.branchId}</div>
            <div className="col-span-2">{o.items?.length || 0}</div>
            <div className="col-span-2">{new Date(o.createdAt).toLocaleDateString()}</div>
            <div className="col-span-2">{o.items?.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0)}</div>
            <div className="col-span-2">
              <span
                className="rounded-full text-xs px-2 py-1"
                style={{ background: "color-mix(in oklab, var(--color-brand-accent), transparent 85%)" }}
              >
                {o.status}
              </span>
            </div>
            <div className="col-span-1 text-right">
              <Button size="sm" onClick={() => setSelected(o)}>
                View
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-sm opacity-70">Order #{selected.id}</div>
              <div className="text-sm">Status: {selected.status}</div>
              <div className="text-sm">Items: {selected.items?.length}</div>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Update filters to a new location?"
        description="You’re changing the Organization/Branch for this page. This won’t affect your global selection in the top bar."
        confirmText="Update"
        onConfirm={applyChange}
      />
    </div>
  )
}
