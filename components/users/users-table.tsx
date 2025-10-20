"use client"

import useSWR from "swr"
import { useState } from "react"
import { jsonFetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Edit, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { handleError } from "@/lib/error-handler"

type UserRow = { id: string; firstName: string; lastName: string; email: string; role: string; organizationId?: number | null; branchId?: number | null; phone?: string; loginCode?: string; mfaEnabled?: boolean; createdAt: string }
type UsersResp = { items: UserRow[] }

export function UsersTable() {
  const { data, error, mutate, isLoading } = useSWR<UsersResp>("/api/v1/users", jsonFetcher)
  const { data: orgsData } = useSWR("/api/v1/organizations", jsonFetcher)
  const { data: branchesData } = useSWR("/api/v1/branches", jsonFetcher)
  const { toast } = useToast()
  
  const [filter, setFilter] = useState("")
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organizationId: "",
    branchId: "",
    mfaEnabled: false
  })

  const organizations = orgsData?.items || []
  const branches = branchesData?.items || []

  async function deleteUser(u: UserRow) {
    if (!confirm("Delete this user?")) return
    try {
      const response = await jsonFetcher(`/api/v1/users/${u.id}`, { method: "DELETE" })
      
      if (response.error) {
        throw new Error(response.error)
      }

      toast({
        title: "Success!",
        description: "User deleted successfully.",
        variant: "default",
      })
      
      mutate()
    } catch (error: any) {
      const { message } = handleError(error, "delete user")
      
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    }
  }

  function openEditDialog(user: UserRow) {
    setEditingUser(user)
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      organizationId: user.organizationId ? String(user.organizationId) : "",
      branchId: user.branchId ? String(user.branchId) : "",
      mfaEnabled: user.mfaEnabled || false
    })
  }

  function closeEditDialog() {
    setEditingUser(null)
    setEditForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      organizationId: "",
      branchId: "",
      mfaEnabled: false
    })
  }

  async function saveEdit() {
    if (!editingUser) return
    
    try {
      const response = await jsonFetcher(`/api/v1/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone || null,
          organizationId: editForm.organizationId ? parseInt(editForm.organizationId) : null,
          branchId: editForm.branchId ? parseInt(editForm.branchId) : null,
          mfaEnabled: editForm.mfaEnabled
        })
      })

      if (response.error) {
        throw new Error(response.error)
      }

      toast({
        title: "Success!",
        description: "User updated successfully.",
        variant: "default",
      })

    mutate()
      closeEditDialog()
    } catch (error: any) {
      const { message } = handleError(error, "update user")
      
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    }
  }

  if (error)
    return (
      <div className="text-sm" style={{ color: "var(--color-destructive)" }}>
        {error.message}
      </div>
    )

  const f = filter.toLowerCase()
  const rows = (data?.items || []).filter((u) =>
    (u.firstName || "").toLowerCase().includes(f) ||
    (u.lastName || "").toLowerCase().includes(f) ||
    (u.email || "").toLowerCase().includes(f)
  )

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <Input placeholder="Search by name or email" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        {isLoading && <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={14} /> Loading…</span>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Org</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>MFA</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">No users found.</TableCell>
            </TableRow>
          ) : (
            rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.firstName} {u.lastName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.phone || "-"}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{u.organizationId || "-"}</TableCell>
                <TableCell>{u.branchId || "-"}</TableCell>
                <TableCell>{u.mfaEnabled ? "✓" : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(u)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteUser(u)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <select
                id="organization"
                value={editForm.organizationId}
                onChange={(e) => setEditForm({ ...editForm, organizationId: e.target.value, branchId: "" })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No Organization</option>
                {organizations.map((org: any) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <select
                id="branch"
                value={editForm.branchId}
                onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
                disabled={!editForm.organizationId}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">No Branch</option>
                {branches
                  .filter((b: any) => !editForm.organizationId || b.organizationId === parseInt(editForm.organizationId))
                  .map((branch: any) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="mfaEnabled"
                checked={editForm.mfaEnabled}
                onChange={(e) => setEditForm({ ...editForm, mfaEnabled: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="mfaEnabled" className="cursor-pointer">Enable MFA</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
