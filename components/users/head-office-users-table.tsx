"use client"
import { useState, useMemo } from "react"
import { jsonFetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Trash2, Search, User, Mail, Phone, Shield, Building2, MapPin, AlertCircle } from "lucide-react"

type UserRow = { 
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: string
  organizationId?: number | null
  branchId?: number | null
  phone?: string
  loginCode?: string
  mfaEnabled?: boolean
  createdAt: string
}

type HeadOfficeUsersTableProps = {
  users: UserRow[]
  branches: any[]
  onUserUpdate: () => void
}

export function HeadOfficeUsersTable({ users, branches, onUserUpdate }: HeadOfficeUsersTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null)

  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    organizationId: "",
    branchId: "",
    mfaEnabled: false,
    loginCode: ""
  })

  // Filter users
  const filteredUsers = useMemo(() => {
    let filtered = users

    // Apply role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(user =>
        user.firstName?.toLowerCase().includes(query) ||
        user.lastName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [users, searchQuery, roleFilter])

  // Get branch name by ID
  const getBranchName = (branchId: number | null) => {
    if (!branchId) return "—"
    const branch = branches.find(b => b.id === branchId)
    return branch?.name || "Unknown"
  }

  // Open edit dialog
  const openEditDialog = (user: UserRow) => {
    setEditingUser(user)
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "",
      organizationId: user.organizationId ? String(user.organizationId) : "",
      branchId: user.branchId ? String(user.branchId) : "",
      mfaEnabled: user.mfaEnabled || false,
      loginCode: user.loginCode || ""
    })
  }

  // Close edit dialog
  const closeEditDialog = () => {
    setEditingUser(null)
    setEditForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "",
      organizationId: "",
      branchId: "",
      mfaEnabled: false,
      loginCode: ""
    })
  }

  // Save user changes
  const saveUser = async () => {
    if (!editingUser) return

    setSubmitting(true)
    try {
      await jsonFetcher(`/api/v1/users/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone || null,
          role: editForm.role,
          organizationId: editForm.organizationId ? parseInt(editForm.organizationId) : null,
          branchId: editForm.branchId ? parseInt(editForm.branchId) : null,
          mfaEnabled: editForm.mfaEnabled,
          loginCode: editForm.loginCode || null
        })
      })

      onUserUpdate()
      closeEditDialog()
    } catch (error: any) {
      console.error("Error updating user:", error)
      alert("Failed to update user: " + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Delete user
  const deleteUser = async (user: UserRow) => {
    setSubmitting(true)
    try {
      await jsonFetcher(`/api/v1/users/${user.id}`, { method: "DELETE" })
      onUserUpdate()
      setDeleteConfirm(null)
    } catch (error: any) {
      console.error("Error deleting user:", error)
      alert("Failed to delete user: " + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Get role badge variant
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "HEAD_OFFICE":
        return <Badge className="bg-blue-100 text-blue-800">Head Office</Badge>
      case "BRANCH_ADMIN":
        return <Badge className="bg-green-100 text-green-800">Branch Admin</Badge>
      case "SUPER_ADMIN":
        return <Badge className="bg-purple-100 text-purple-800">Super Admin</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="HEAD_OFFICE">Head Office</SelectItem>
            <SelectItem value="BRANCH_ADMIN">Branch Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">User</TableHead>
              <TableHead className="w-[150px]">Contact</TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead className="w-[150px]">Assignment</TableHead>
              <TableHead className="w-[100px]">Security</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <User className="h-12 w-12 opacity-20" />
                    <p className="text-sm font-medium">No users found</p>
                    <p className="text-xs">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{user.fullName || `${user.firstName} ${user.lastName}`}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {user.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {user.email}
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(user.role)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {user.branchId ? (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {getBranchName(user.branchId)}
                        </div>
                      ) : user.organizationId ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          Organization
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.mfaEnabled ? (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <Shield className="mr-1 h-3 w-3" />
                          MFA
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(user)}
                        title="Edit user"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteConfirm(user)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete user"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={editForm.firstName}
                    onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={editForm.lastName}
                    onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            {/* Role and Assignment */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Role & Assignment</h3>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={editForm.role} onValueChange={value => setEditForm({ ...editForm, role: value, branchId: "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HEAD_OFFICE">Head Office</SelectItem>
                    <SelectItem value="BRANCH_ADMIN">Branch Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {editForm.role === "BRANCH_ADMIN" && (
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch Assignment *</Label>
                  <Select value={editForm.branchId} onValueChange={value => setEditForm({ ...editForm, branchId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={String(branch.id)}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Security Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Security Settings</h3>
              <div className="space-y-2">
                <Label htmlFor="loginCode">Login Code</Label>
                <Input
                  id="loginCode"
                  value={editForm.loginCode}
                  onChange={e => setEditForm({ ...editForm, loginCode: e.target.value })}
                  placeholder="6-digit code (optional)"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate a new code
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mfaEnabled"
                  checked={editForm.mfaEnabled}
                  onCheckedChange={checked => setEditForm({ ...editForm, mfaEnabled: !!checked })}
                />
                <Label htmlFor="mfaEnabled" className="cursor-pointer">
                  Enable Multi-Factor Authentication
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button
              onClick={saveUser}
              disabled={submitting || !editForm.firstName || !editForm.lastName || !editForm.email || !editForm.role}
              style={{ background: "var(--color-brand-primary)", color: "white" }}
            >
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.fullName || `${deleteConfirm?.firstName} ${deleteConfirm?.lastName}`}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteUser(deleteConfirm)}
              disabled={submitting}
            >
              {submitting ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
