"use client"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { useOrgBranch } from "@/components/context/org-branch-context"
import { useBranches, useOrganizations } from "@/lib/hooks/use-api"

export default function AddInventoryPage() {
  const { organizationId: globalOrgId, branchId: globalBranchId } = useOrgBranch()
  const [form, setForm] = useState({
    organizationId: globalOrgId || "",
    branchId: globalBranchId || "",
    warehouseId: "",
    note: "",
    items: [{ sku: "", name: "", quantity: 0, unit: "pcs" }],
  })
  const { data: orgRes } = useOrganizations()
  const { data: branchRes } = useBranches(form.organizationId || undefined)
  const orgs = orgRes?.items || []
  const branches = branchRes?.items || []

  function setItem(idx: number, field: string, value: any) {
    const items = [...form.items]
    ;(items[idx] as any)[field] = value
    setForm({ ...form, items })
  }

  async function onSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/v1/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "ADD" }),
      })
      if (!res.ok) throw new Error("Failed")
      alert("Inventory added")
    } finally {
      setSaving(false)
    }
  }

  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add Inventory</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-1">
          <label className="text-sm">Organization</label>
          <Select
            value={form.organizationId}
            onChange={(e: any) => setForm({ ...form, organizationId: e.target.value, branchId: "" })}
          >
            <option value="">{globalOrgId ? "Use Global Org" : "Select organization"}</option>
            {orgs.map((o: any) => (
              <option key={o.id} value={String(o.id)}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-sm">Branch</label>
          <Select
            value={form.branchId}
            onChange={(e: any) => setForm({ ...form, branchId: e.target.value })}
            disabled={!form.organizationId}
          >
            <option value="">{globalBranchId ? "Use Global Branch" : "Select branch"}</option>
            {branches.map((b: any) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-sm">Warehouse Id</label>
          <Input value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-2">
        <div className="text-sm font-medium">Items</div>
        {form.items.map((it, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-4">
            <Input placeholder="SKU" value={it.sku} onChange={(e) => setItem(i, "sku", e.target.value)} />
            <Input placeholder="Name" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} />
            <Input
              placeholder="Qty"
              type="number"
              value={it.quantity}
              onChange={(e) => setItem(i, "quantity", Number(e.target.value))}
            />
            <Input placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} />
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              setForm({ ...form, items: [...form.items, { sku: "", name: "", quantity: 0, unit: "pcs" }] })
            }
          >
            Add Item
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => history.back()}>
          Back
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  )
}
