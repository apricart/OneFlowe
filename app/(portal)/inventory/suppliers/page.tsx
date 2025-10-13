"use client"
import { useState } from "react"
import { useAPI } from "@/lib/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function SuppliersPage() {
  const { data, mutate } = useAPI<{ items: any[] }>("/api/v1/suppliers")
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ organizationId: "", branchId: "", name: "", address: "", contact: "", email: "", description: "" })
  const items = data?.items || []

  async function onSave() {
    const res = await fetch("/api/v1/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    if (res.ok) {
      setOpen(false)
      setForm({ organizationId: "", branchId: "", name: "", address: "", contact: "", email: "", description: "" })
      mutate()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage supplier contacts</p>
        </div>
        <Button onClick={() => setOpen(true)}>Add Supplier</Button>
      </div>

      <div className="grid grid-cols-12 gap-2 p-4 text-xs font-medium opacity-60">
        <div className="col-span-3">Name</div>
        <div className="col-span-3">Address</div>
        <div className="col-span-2">Contact</div>
        <div className="col-span-3">Email</div>
        <div className="col-span-1 text-right">Action</div>
      </div>
      {items.map((s) => (
        <div key={s.id} className="grid grid-cols-12 gap-2 p-4 border-t">
          <div className="col-span-3">{s.name}</div>
          <div className="col-span-3">{s.address}</div>
          <div className="col-span-2">{s.contact}</div>
          <div className="col-span-3">{s.email}</div>
          <div className="col-span-1 text-right">
            <Button size="sm" variant="secondary">Edit</Button>
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-sm">Organization Id</label>
              <Input value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Branch Id</label>
              <Input value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Address</label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Contact</label>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-sm">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSave}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

