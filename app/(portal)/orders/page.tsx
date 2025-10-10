"use client"
import { useState, useMemo } from "react"
import { useOrders } from "@/lib/hooks/use-api"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const statuses = ["PENDING", "APPROVED", "REJECTED", "FULFILLED"] as const

export default function OrdersPage() {
  const [status, setStatus] = useState<string>("")
  const [branchId, setBranchId] = useState<string>("")
  const [organizationId, setOrganizationId] = useState<string>("")
  const { data, isLoading, mutate } = useOrders({ status, branchId: branchId || undefined, organizationId: organizationId || undefined })
  const [selected, setSelected] = useState<any | null>(null)

  const items = data?.items || []
  const hasItems = items.length > 0

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Input placeholder="Select Dates" readOnly />
        <Input placeholder="Select Location" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
        <Select value={status} onChange={(e: any) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Button onClick={() => mutate()}>Filter</Button>
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
              <span className="rounded-full text-xs px-2 py-1" style={{ background: "color-mix(in oklab, var(--color-brand-accent), transparent 85%)" }}>{o.status}</span>
            </div>
            <div className="col-span-1 text-right">
              <Button size="sm" onClick={() => setSelected(o)}>View</Button>
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
                <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}


