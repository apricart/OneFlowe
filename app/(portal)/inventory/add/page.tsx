"use client"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function AddInventoryPage() {
  const [form, setForm] = useState({ organizationId: "", branchId: "", warehouseId: "", note: "", items: [{ sku: "", name: "", quantity: 0, unit: "pcs" }] })
  const [saving, setSaving] = useState(false)
  function setItem(idx: number, field: string, value: any) {
    const items = [...form.items]
    ;(items[idx] as any)[field] = value
    setForm({ ...form, items })
  }
  async function onSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/v1/inventory/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, type: "ADD" }) })
      if (!res.ok) throw new Error("Failed")
      alert("Inventory added")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add Inventory</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-1"><label className="text-sm">Organization Id</label><Input value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} /></div>
        <div className="grid gap-1"><label className="text-sm">Branch Id</label><Input value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} /></div>
        <div className="grid gap-1"><label className="text-sm">Warehouse Id</label><Input value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} /></div>
      </div>
      <div className="grid gap-2">
        <div className="text-sm font-medium">Items</div>
        {form.items.map((it, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-4">
            <Input placeholder="SKU" value={it.sku} onChange={(e) => setItem(i, "sku", e.target.value)} />
            <Input placeholder="Name" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} />
            <Input placeholder="Qty" type="number" value={it.quantity} onChange={(e) => setItem(i, "quantity", Number(e.target.value))} />
            <Input placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} />
          </div>
        ))}
        <div>
          <Button variant="secondary" onClick={() => setForm({ ...form, items: [...form.items, { sku: "", name: "", quantity: 0, unit: "pcs" }] })}>Add Item</Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => history.back()}>Back</Button>
        <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </div>
    </div>
  )
}

