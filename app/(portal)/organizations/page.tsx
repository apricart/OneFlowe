"use client"
import { useOrganizations, useBranches } from "@/lib/hooks/use-api"
type Organization = { id: number; name: string; code: string }
type Branch = { id: number; name: string; code: string; organizationId: number }
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"

type OrgsRes = { items: Organization[] }
type BranchesRes = { items: Branch[] }

export default function OrganizationsPage() {
  const { data: orgs, mutate: refetchOrgs, isLoading: loadingOrgs } = useOrganizations()
  const { data: branches, mutate: refetchBranches } = useBranches()

  const [openOrg, setOpenOrg] = useState(false)
  const [openBranch, setOpenBranch] = useState(false)

  const orgCount = orgs?.items.length ?? 0
  const branchCount = branches?.items.length ?? 0

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className={cn("text-2xl font-semibold text-balance")}>Companies</h1>
        <div className="flex gap-2">
          <CreateOrgDialog
            open={openOrg}
            onOpenChange={setOpenOrg}
            onCreated={() => {
              setOpenOrg(false)
              refetchOrgs()
            }}
          />
          <CreateBranchDialog
            organizations={orgs?.items || []}
            open={openBranch}
            onOpenChange={setOpenBranch}
            onCreated={() => {
              setOpenBranch(false)
              refetchBranches()
            }}
          />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-primary text-primary-foreground p-4">
              <div className="text-sm opacity-90">Companies</div>
              <div className="text-2xl font-bold">{orgCount}</div>
            </div>
            <div className="rounded-lg bg-accent text-accent-foreground p-4">
              <div className="text-sm opacity-90">Branches</div>
              <div className="text-2xl font-bold">{branchCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            Use Companies to represent each tenant. Add Head Office users to a company without a branch, and Branch
            Admin users to a specific branch within a company.
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company List</CardTitle>
          </CardHeader>
          <CardContent>
            <CompaniesTable items={orgs?.items || []} refresh={refetchOrgs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
          </CardHeader>
          <CardContent>
            <BranchesTable items={branches?.items || []} organizations={orgs?.items || []} refresh={refetchBranches} />
          </CardContent>
        </Card>
      </section>

      {loadingOrgs && <div className="text-sm text-muted-foreground">Loading...</div>}
    </main>
  )
}

function CompaniesTable({ items, refresh }: { items: Organization[]; refresh: () => void }) {
  async function remove(id: string) {
    await fetch(`/api/v1/organizations/${id}`, { method: "DELETE" })
    refresh()
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left border-b">
          <tr>
            <th className="py-2 pr-2">Name</th>
            <th className="py-2 pr-2">Code</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id} className="border-b last:border-0">
              <td className="py-2 pr-2">{o.name}</td>
              <td className="py-2 pr-2">{o.code}</td>
              <td className="py-2 pr-2 capitalize">{o.status}</td>
              <td className="py-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => remove(o.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="py-3 text-muted-foreground" colSpan={4}>
                No companies yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function BranchesTable({
  items,
  organizations,
  refresh,
}: {
  items: Branch[]
  organizations: Organization[]
  refresh: () => void
}) {
  const orgById = useMemo(() => Object.fromEntries(organizations.map((o) => [o.id, o])), [organizations])
  async function remove(id: string) {
    await fetch(`/api/v1/branches/${id}`, { method: "DELETE" })
    refresh()
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left border-b">
          <tr>
            <th className="py-2 pr-2">Branch</th>
            <th className="py-2 pr-2">Code</th>
            <th className="py-2 pr-2">Company</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} className="border-b last:border-0">
              <td className="py-2 pr-2">{b.name}</td>
              <td className="py-2 pr-2">{b.code}</td>
              <td className="py-2 pr-2">{orgById[b.organizationId]?.name || "—"}</td>
              <td className="py-2 pr-2 capitalize">{b.status}</td>
              <td className="py-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => remove(b.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="py-3 text-muted-foreground" colSpan={5}>
                No branches yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  async function submit() {
    await fetch("/api/v1/organizations", {
      method: "POST",
      body: JSON.stringify({ name, code, status }),
    })
    setName("")
    setCode("")
    setStatus("active")
    onCreated()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Create Company</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Company</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ACME" />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: "active" | "inactive") => setStatus(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Save</Button>
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
}: {
  organizations: Organization[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [orgId, setOrgId] = useState<string | undefined>(undefined)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [status, setStatus] = useState<"active" | "inactive">("active")
  async function submit() {
    if (!orgId) return
    await fetch("/api/v1/branches", {
      method: "POST",
      body: JSON.stringify({ organizationId: orgId, name, code, status }),
    })
    setName("")
    setCode("")
    setStatus("active")
    setOrgId(undefined)
    onCreated()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">Create Branch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Branch</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Company</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bname">Branch Name</Label>
            <Input id="bname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown Branch" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bcode">Code</Label>
            <Input id="bcode" value={code} onChange={(e) => setCode(e.target.value)} placeholder="DT-01" />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: "active" | "inactive") => setStatus(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!orgId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
