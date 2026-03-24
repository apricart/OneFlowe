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
import { Edit, Trash2, Search, User, Mail, Phone, Shield, Building2, MapPin, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Power, Eye, EyeOff, Upload, FileText, Table as TableIcon, FileJson } from "lucide-react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

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
  mfaEnabled?: boolean
  isActive: boolean
  createdAt: string
  employeeId?: string | null
  imprestHolder?: string | null
  contactPerson?: string | null
  address?: string | null
}

type HeadOfficeUsersTableProps = {
  users: UserRow[]
  branches: any[]
  organizations: any[]
  userRole?: string
  onUserUpdate: () => void
}

export function HeadOfficeUsersTable({ users, branches, organizations, userRole, onUserUpdate }: HeadOfficeUsersTableProps) {
  const PAGE_SIZE = 20
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null)

  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    organizationId: "",
    branchId: "",
    mfaEnabled: false,
    isActive: true,
    password: "",
    confirmPassword: "",
    employeeId: "",
    imprestHolder: "",
    contactPerson: "",
    address: ""
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

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))

  useMemo(() => {
    setPage(1)
  }, [searchQuery, roleFilter])

  useMemo(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [totalPages, page])

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, page])

  const organizationMap = useMemo(() => {
    const map = new Map<number, string>()
    organizations.forEach((org: any) => {
      if (org?.id) {
        map.set(org.id, org.name)
      }
    })
    return map
  }, [organizations])

  const orgStatusMap = useMemo(() => {
    const map = new Map<number, string>()
    organizations.forEach((org: any) => {
      if (org?.id) {
        map.set(org.id, org.status || "active")
      }
    })
    return map
  }, [organizations])

  const branchMap = useMemo(() => {
    const map = new Map<number, string>()
    branches.forEach((branch: any) => {
      if (branch?.id) {
        map.set(branch.id, branch.name)
      }
    })
    return map
  }, [branches])

  const getBranchName = (branchId: number | null | undefined) => {
    if (!branchId) return "—"
    return branchMap.get(branchId as number) || "Unknown"
  }

  const getOrganizationName = (organizationId: number | null | undefined) => {
    if (!organizationId) return "—"
    return organizationMap.get(organizationId as number) || "Unknown"
  }

  // Open edit dialog
  const openEditDialog = (user: UserRow) => {
    setEditingUser(user)
    setShowPasswordReset(false)
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "",
      organizationId: user.organizationId ? String(user.organizationId) : "",
      branchId: user.branchId ? String(user.branchId) : "",
      mfaEnabled: user.mfaEnabled || false,
      isActive: user.isActive,
      password: "",
      confirmPassword: "",
      employeeId: user.employeeId || "",
      imprestHolder: user.imprestHolder || "",
      contactPerson: user.contactPerson || "",
      address: user.address || ""
    })
  }

  // Close edit dialog
  const closeEditDialog = () => {
    setEditingUser(null)
    setShowPasswordReset(false)
    setEditForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "",
      organizationId: "",
      branchId: "",
      mfaEnabled: false,
      isActive: true,
      password: "",
      confirmPassword: "",
      employeeId: "",
      imprestHolder: "",
      contactPerson: "",
      address: ""
    })
  }

  // Save user changes
  const saveUser = async () => {
    if (!editingUser) return

    // Validate password if reset is enabled
    if (showPasswordReset && editForm.password) {
      if (editForm.password !== editForm.confirmPassword) {
        alert("Passwords do not match")
        return
      }
      if (editForm.password.length < 12) {
        alert("Password must be at least 12 characters")
        return
      }
      if (!/[A-Z]/.test(editForm.password) || !/[a-z]/.test(editForm.password) || !/\d/.test(editForm.password) || !/[^a-zA-Z0-9]/.test(editForm.password)) {
        alert("Password must include uppercase, lowercase, number, and special character")
        return
      }
    }

    setSubmittingUserId(editingUser.id)
    try {
      const body: any = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone || null,
        role: editForm.role,
        organizationId: editForm.organizationId ? parseInt(editForm.organizationId) : null,
        branchId: editForm.branchId ? parseInt(editForm.branchId) : null,
        mfaEnabled: editForm.mfaEnabled,
        isActive: editForm.isActive,
        employeeId: editForm.employeeId.trim() || null,
        imprestHolder: editForm.imprestHolder.trim() || null,
        contactPerson: editForm.contactPerson.trim() || null,
        address: editForm.address.trim() || null
      }

      // Include password if password reset is enabled
      if (showPasswordReset && editForm.password) {
        body.password = editForm.password
      }

      await jsonFetcher(`/api/v1/users/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      })

      onUserUpdate()
      closeEditDialog()
    } catch (error: any) {
      console.error("Error updating user:", error)
      alert("Failed to update user: " + error.message)
    } finally {
      setSubmittingUserId(null)
    }
  }

  // Delete user
  const deleteUser = async (user: UserRow) => {
    setSubmittingUserId(user.id)
    try {
      await jsonFetcher(`/api/v1/users/${user.id}`, { method: "DELETE" })
      onUserUpdate()
      setDeleteConfirm(null)
    } catch (error: any) {
      console.error("Error deleting user:", error)
      alert("Failed to delete user: " + error.message)
    } finally {
      setSubmittingUserId(null)
    }
  }

  // Toggle user status
  const toggleUserStatus = async (user: UserRow) => {
    setSubmittingUserId(user.id)
    try {
      await jsonFetcher(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive })
      })
      onUserUpdate()
    } catch (error: any) {
      console.error("Error toggling user status:", error)
      alert("Failed to update user status: " + error.message)
    } finally {
      setSubmittingUserId(null)
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
      case "ORDER_PORTAL":
        return <Badge className="bg-orange-100 text-orange-800">Order Portal</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  // Export handlers
  const exportToCSV = () => {
    const headers = ["Name", "Email", "Phone", "Role", "Organization", "Branch", "Company Status", "User Status", "Security (MFA)"]
    const rows = filteredUsers.map(user => [
      user.fullName || `${user.firstName} ${user.lastName}`,
      user.email,
      user.phone || "—",
      user.role,
      getOrganizationName(user.organizationId) || "—",
      getBranchName(user.branchId),
      orgStatusMap.get(user.organizationId as number) || "—",
      user.isActive ? "Active" : "Inactive",
      user.mfaEnabled ? "Enabled" : "Disabled"
    ])

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `users-export-${new Date().getTime()}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToExcel = () => {
    const data = filteredUsers.map(user => ({
      "Name": user.fullName || `${user.firstName} ${user.lastName}`,
      "Email": user.email,
      "Phone": user.phone || "—",
      "Role": user.role,
      "Organization": getOrganizationName(user.organizationId) || "—",
      "Branch": getBranchName(user.branchId),
      "Company Status": orgStatusMap.get(user.organizationId as number) || "—",
      "User Status": user.isActive ? "Active" : "Inactive",
      "Security (MFA)": user.mfaEnabled ? "Enabled" : "Disabled"
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users")
    XLSX.writeFile(workbook, `users-export-${new Date().getTime()}.xlsx`)
  }

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(18)
    doc.text("User Directory Report", 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
    doc.text(`Total Users: ${filteredUsers.length}`, 14, 34)

    const headers = ["Name", "Email", "Phone", "Role", "Org", "Branch", "Co. Status", "User Status", "MFA"]
    const tableData = filteredUsers.map(user => [
      user.fullName || `${user.firstName} ${user.lastName}`,
      user.email,
      user.phone || "—",
      user.role,
      getOrganizationName(user.organizationId) || "—",
      getBranchName(user.branchId),
      orgStatusMap.get(user.organizationId as number) || "—",
      user.isActive ? "Active" : "Inactive",
      user.mfaEnabled ? "Enabled" : "Disabled"
    ])

    autoTable(doc, {
      startY: 40,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 8 }
    })

    doc.save(`users-export-${new Date().getTime()}.pdf`)
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
            autoComplete="off"
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
            <SelectItem value="ORDER_PORTAL">Order Portal User</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 h-10 border-slate-200 bg-white dark:bg-slate-900 shadow-sm">
              <Upload className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Export Directory</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4 text-orange-500" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
              <TableIcon className="h-4 w-4 text-green-600" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
              <FileJson className="h-4 w-4 text-red-500" />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">User</TableHead>
              <TableHead className="w-[100px]">Employee #</TableHead>
              <TableHead className="w-[150px]">Contact</TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead className="w-[150px]">Assignment</TableHead>
              <TableHead className="w-[100px]">Imprest</TableHead>
              <TableHead className="w-[100px]">Contact Person</TableHead>
              <TableHead className="w-[150px]">Address</TableHead>
              <TableHead className="w-[120px]">Company Status</TableHead>
              <TableHead className="w-[120px]">User Status</TableHead>
              <TableHead className="w-[100px]">Security</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <User className="h-12 w-12 opacity-20" />
                    <p className="text-sm font-medium">No users found</p>
                    <p className="text-xs">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => (
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
                    <span className="text-sm">{user.employeeId || "—"}</span>
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
                      {user.organizationId ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {getOrganizationName(user.organizationId)}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                      {user.branchId && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {getBranchName(user.branchId)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{user.imprestHolder || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{user.contactPerson || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm line-clamp-2 max-w-[150px]" title={user.address || ""}>
                      {user.address || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.organizationId ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          orgStatusMap.get(user.organizationId) === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {orgStatusMap.get(user.organizationId) === "active" ? "Active" : "Inactive"}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          user.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {userRole === "SUPER_ADMIN" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={submittingUserId === user.id}
                          onClick={() => toggleUserStatus(user)}
                          title={user.isActive ? "Deactivate User" : "Activate User"}
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", submittingUserId === user.id && "animate-spin")} />
                        </Button>
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

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-muted-foreground">
        <span>
          Showing{" "}
          <span className="font-medium text-foreground">
            {filteredUsers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
            –
            {Math.min(filteredUsers.length, page * PAGE_SIZE)}
          </span>{" "}
          of <span className="font-medium text-foreground">{filteredUsers.length}</span> users
        </span>
        <div className="inline-flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs">
            Page <span className="font-medium text-foreground">{page}</span> / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages || filteredUsers.length === 0}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
                  autoComplete="off"
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
              {/* New Fields: Employee #, Imprest Holder, Contact Person */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-employeeId">Employee #</Label>
                  <Input
                    id="edit-employeeId"
                    value={editForm.employeeId}
                    onChange={e => setEditForm({ ...editForm, employeeId: e.target.value })}
                    placeholder="Enter employee number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contactPerson">Contact Person</Label>
                  <Input
                  id="edit-contactPerson"
                  value={editForm.contactPerson}
                  onChange={e => setEditForm({ ...editForm, contactPerson: e.target.value })}
                  placeholder="Enter contact person"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={editForm.address}
                onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Enter full address"
                className="h-20"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-imprestHolder">Imprest Holder</Label>
                <Input
                  id="edit-imprestHolder"
                  value={editForm.imprestHolder}
                  onChange={e => setEditForm({ ...editForm, imprestHolder: e.target.value })}
                  placeholder="Enter imprest holder name"
                />
              </div>
            </div>

            {/* Role and Assignment */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Role & Assignment</h3>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select disabled value={editForm.role} onValueChange={value => setEditForm({ ...editForm, role: value, branchId: "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HEAD_OFFICE">Head Office</SelectItem>
                    <SelectItem value="BRANCH_ADMIN">Branch Admin</SelectItem>
                    <SelectItem value="ORDER_PORTAL">Order Portal User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editForm.role === "BRANCH_ADMIN" || editForm.role === "ORDER_PORTAL") && (
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch Assignment *</Label>
                  <Select disabled value={editForm.branchId} onValueChange={value => setEditForm({ ...editForm, branchId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches
                        .filter(branch => !editForm.organizationId || branch.organizationId === parseInt(editForm.organizationId))
                        .map((branch) => (
                          <SelectItem key={branch.id} value={String(branch.id)}>
                            {branch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Security & Access */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Security & Access</h3>
              <div className="flex flex-col gap-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive" className="text-base">Account Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable this user's ability to log in
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={editForm.isActive ? "default" : "secondary"} className={cn(
                      editForm.isActive ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
                    )}>
                      {editForm.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Switch
                      id="isActive"
                      checked={editForm.isActive}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-mfa" className="text-base">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Require MFA for this user
                    </p>
                  </div>
                  <Switch
                    id="edit-mfa"
                    checked={editForm.mfaEnabled}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, mfaEnabled: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Password Reset */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Password Reset</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPasswordReset(!showPasswordReset)
                    if (showPasswordReset) {
                      setEditForm({ ...editForm, password: "", confirmPassword: "" })
                    }
                  }}
                >
                  {showPasswordReset ? "Cancel" : "Reset Password"}
                </Button>
              </div>
              {showPasswordReset && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={editForm.password}
                        onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                        placeholder="Enter password (min 12 chars, mixed case, symbols)"
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={editForm.confirmPassword}
                        onChange={e => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                        placeholder="Confirm new password"
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {editForm.password && editForm.confirmPassword && editForm.password !== editForm.confirmPassword && (
                      <p className="text-sm text-red-600">Passwords do not match</p>
                    )}
                    {editForm.password && editForm.password.length > 0 && editForm.password.length < 12 && (
                      <p className="text-sm text-red-600">Password must be at least 12 characters</p>
                    )}
                    {editForm.password && editForm.password.length >= 12 && (!/[A-Z]/.test(editForm.password) || !/[a-z]/.test(editForm.password) || !/\d/.test(editForm.password) || !/[^a-zA-Z0-9]/.test(editForm.password)) && (
                      <p className="text-sm text-red-600">Password must include uppercase, lowercase, number, and special character</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button
              onClick={saveUser}
              disabled={
                !!submittingUserId ||
                !editForm.firstName ||
                !editForm.lastName ||
                !editForm.email ||
                !editForm.role ||
                ((editForm.role === "BRANCH_ADMIN" || editForm.role === "ORDER_PORTAL") && !editForm.branchId) ||
                (showPasswordReset && (
                  !editForm.password ||
                  !editForm.confirmPassword ||
                  editForm.password !== editForm.confirmPassword ||
                  editForm.password.length < 12 ||
                  !/[A-Z]/.test(editForm.password) ||
                  !/[a-z]/.test(editForm.password) ||
                  !/\d/.test(editForm.password) ||
                  !/[^a-zA-Z0-9]/.test(editForm.password)
                ))
              }
              style={{ background: "var(--color-brand-primary)", color: "white" }}
            >
              {submittingUserId ? "Saving..." : "Save Changes"}
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
              disabled={!!submittingUserId}
            >
              {submittingUserId ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
