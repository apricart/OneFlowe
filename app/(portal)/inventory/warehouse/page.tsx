"use client"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

export default function AddWarehousePage() {
  const [form, setForm] = useState({
    organizationId: "",
    branchId: "",
    name: "",
    code: "",
    contact: "",
    email: "",
    description: "",
    isMain: false,
  })
  const [saving, setSaving] = useState(false)
  async function onSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/v1/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Failed")
      setForm({ organizationId: "", branchId: "", name: "", code: "", contact: "", email: "", description: "", isMain: false })
      alert("Warehouse saved")
    } catch {
      alert("Could not save")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add Warehouse</h1>
        <p className="text-sm text-muted-foreground">Create a warehouse for a branch</p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm">Name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Contact</label>
            <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Code</label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Organization Id</label>
            <Input value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Branch Id</label>
            <Input value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-1">
          <label className="text-sm">Description</label>
          <Textarea as-child value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <input id="isMain" type="checkbox" checked={form.isMain} onChange={(e) => setForm({ ...form, isMain: e.target.checked })} />
          <label htmlFor="isMain" className="text-sm">Is Main Store</label>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => history.back()}>Back</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </div>
  )
}

