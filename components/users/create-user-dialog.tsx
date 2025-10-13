"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOrganizations, useBranches } from "@/lib/hooks/use-api"
import { useOrgBranch } from "@/components/context/org-branch-context"
import { Spinner } from "@/components/ui/skeleton"

type RolesResp = { data: { id: number; name: string }[] }

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    loginCode: "",
    phone: "",
    role: "",
    organizationId: "",
    branchId: "",
    mfaEnabled: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: orgs } = useOrganizations()
  const { data: branches } = useBranches(form.organizationId || undefined)
  const { organizationId: currentOrgId, branchId: currentBranchId } = useOrgBranch()

  const isHeadOffice = form.role === "HEAD_OFFICE"
  const isBranchAdmin = form.role === "BRANCH_ADMIN"

  useEffect(() => {
    if (!open) {
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        loginCode: "",
        phone: "",
        role: "",
        organizationId: "",
        branchId: "",
        mfaEnabled: false,
      })
      setError(null)
    }
  }, [open])

  // Auto-select defaults from global context when dialog opens or role changes
  useEffect(() => {
    if (!open) return
    // Head Office: set org, clear branch
    if (form.role === "HEAD_OFFICE") {
      setForm((f) => ({ ...f, organizationId: f.organizationId || currentOrgId || "", branchId: "" }))
    }
    // Branch Admin: set org and branch if available
    if (form.role === "BRANCH_ADMIN") {
      setForm((f) => ({
        ...f,
        organizationId: f.organizationId || currentOrgId || "",
        branchId: f.branchId || (currentOrgId ? currentBranchId || "" : ""),
      }))
    }
  }, [open, form.role, currentOrgId, currentBranchId])

  async function onCreate() {
    setSubmitting(true)
    setError(null)
    try {
      if (!form.firstName || !form.lastName || !form.email || !form.password || !form.role) {
        setError("First name, last name, email, password, and role are required")
        setSubmitting(false)
        return
      }
      if (isBranchAdmin) {
        if (!form.organizationId || !form.branchId) {
          setError("Organization and branch are required for Branch Admin")
          setSubmitting(false)
          return
        }
      }
      if (isHeadOffice) {
        if (!form.organizationId) {
          setError("Organization is required for Head Office")
          setSubmitting(false)
          return
        }
      }
      await jsonFetcher("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          loginCode: form.loginCode,
          phone: form.phone,
          role: form.role,
          organizationId: isHeadOffice || isBranchAdmin ? (form.organizationId || null) : null,
          branchId: isBranchAdmin ? (form.branchId || null) : null,
          mfaEnabled: form.mfaEnabled,
        }),
      })
      setOpen(false)
      // Hard refresh users table by reloading page, or better: send custom event
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ background: "var(--color-brand-primary)", color: "white" }}>New User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loginCode">Login Code</Label>
              <Input id="loginCode" value={form.loginCode} onChange={(e) => setForm({ ...form, loginCode: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {(["HEAD_OFFICE", "BRANCH_ADMIN"]).map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Organization</Label>
              <Select value={form.organizationId} onValueChange={(v) => setForm({ ...form, organizationId: v, branchId: "" })} disabled={!isHeadOffice && !isBranchAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {(orgs?.items || []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2" style={{ display: isBranchAdmin ? undefined : "none" }}>
            <Label>Branch</Label>
            <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })} disabled={!form.organizationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {(branches?.items || []).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input id="mfa" type="checkbox" checked={form.mfaEnabled} onChange={(e) => setForm({ ...form, mfaEnabled: e.target.checked })} />
            <Label htmlFor="mfa">Enable Multi-Factor Authentication</Label>
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={onCreate}
            disabled={submitting}
            style={{ background: "var(--color-brand-accent)", color: "black" }}
          >
            {submitting ? <span className="inline-flex items-center gap-2"><Spinner size={14} /> Creating…</span> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
