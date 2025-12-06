"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Search,
  X,
  Package,
  Building2,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Edit,
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"
import { formatPKR } from "@/lib/utils"
import { useRouter, useSearchParams } from "next/navigation"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface OrganizationAssignment {
  id: number
  organizationId: number
  globalProductId: number
  isActive: boolean
  customName?: string
  customPrice?: number
  customDescription?: string
  customImageUrl?: string
  assignedAt: string
  productName: string
  productCode: string
  productImageUrl?: string
  organizationName: string
}

interface Organization {
  id: number
  name: string
  description?: string
  createdAt: string
}

interface GlobalProduct {
  id: number
  productCode: string
  name: string
  basePrice: number
}

export default function OrganizationAssignmentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [organizationFilter, setOrganizationFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("")
  const [initialProductIds, setInitialProductIds] = useState<number[]>([])
  const [assignmentDraft, setAssignmentDraft] = useState<Record<number, { customPrice: string }>>({})
  const [selectedAssignments, setSelectedAssignments] = useState<number[]>([])
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<OrganizationAssignment | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    isActive: true,
    customName: "",
    customPrice: "",
    customDescription: "",
    customImageUrl: "",
  })

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [hasAutoOpenedEdit, setHasAutoOpenedEdit] = useState(false)
  const [bootstrapDone, setBootstrapDone] = useState(false)

  const searchParams = useSearchParams()

  // Initialize filters from URL query params for deep-linking (run once per mount)
  useEffect(() => {
    if (bootstrapDone) return

    const orgId = searchParams.get("organizationId") || ""
    const productId = searchParams.get("productId") || ""
    const productIdsParam = searchParams.get("productIds") || ""
    if (orgId) {
      setOrganizationFilter(orgId)
    }
    if (productId) {
      setProductFilter(productId)
    }
    if (productIdsParam) {
      const ids = productIdsParam
        .split(",")
        .map((v) => parseInt(v))
        .filter((v) => Number.isFinite(v))
      setInitialProductIds(ids)
      if (ids.length > 0) {
        setShowAssignDialog(true)
      }
    }
    setBootstrapDone(true)
  }, [searchParams, bootstrapDone])

  // Fetch data
  const { data: assignments, error: assignmentsError, isLoading: assignmentsLoading, mutate: mutateAssignments } = useSWR<{
    items: OrganizationAssignment[]
    total: number
  }>(`/api/v1/admin/organization-assignments?${new URLSearchParams({
    ...(organizationFilter && { organizationId: organizationFilter }),
    ...(productFilter && { productId: productFilter }),
  })}`, fetcher, {
    fallbackData: { items: [], total: 0 }
  })

  const { data: organizationsData, error: orgsError } = useSWR<{ items: Organization[] }>(
    "/api/v1/organizations",
    fetcher,
    { fallbackData: { items: [] } }
  )
  const organizations = organizationsData?.items || []

  const { data: productsData } = useSWR<{ items: GlobalProduct[] }>(
    "/api/v1/admin/global-inventory?limit=1000",
    fetcher,
    { fallbackData: { items: [] } }
  )

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    if (!assignments?.items) return []
    
    let filtered = assignments.items

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(assignment =>
        assignment.productName.toLowerCase().includes(query) ||
        assignment.productCode.toLowerCase().includes(query) ||
        assignment.organizationName.toLowerCase().includes(query) ||
        (assignment.customName && assignment.customName.toLowerCase().includes(query))
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(assignment =>
        statusFilter === "active" ? assignment.isActive : !assignment.isActive
      )
    }

    return filtered
  }, [assignments?.items, searchQuery, statusFilter])

  const preselectedAssignments = useMemo(() => {
    if (!initialProductIds.length || !assignments?.items) return []
    return assignments.items.filter((a) => initialProductIds.includes(a.globalProductId))
  }, [initialProductIds, assignments?.items])

  const selectedProductsForAssignment = useMemo(() => {
    if (!initialProductIds.length || !productsData?.items) return []
    const set = new Set(initialProductIds)
    return productsData.items.filter((p) => set.has(p.id))
  }, [initialProductIds, productsData?.items])

  // Seed draft state for selected products when coming from "Assign selected"
  useEffect(() => {
    if (!selectedProductsForAssignment.length) return
    setAssignmentDraft((prev) => {
      const next = { ...prev }
      selectedProductsForAssignment.forEach((p) => {
        if (!next[p.id]) {
          next[p.id] = { customPrice: "" }
        }
      })
      return next
    })
  }, [selectedProductsForAssignment])

  const existingProductIds = useMemo(() => {
    if (!assignments?.items) return new Set<number>()
    return new Set(assignments.items.map((a) => a.globalProductId))
  }, [assignments?.items])

  const handleCreateAssignments = async () => {
    if (!organizationFilter) {
      toast({
        title: "No organization selected",
        description: "Select an organization to assign products to.",
        variant: "destructive",
      })
      return
    }

    const targetIds = initialProductIds.filter((id) => !existingProductIds.has(id))
    if (targetIds.length === 0) {
      toast({
        title: "Nothing to assign",
        description: "All selected products are already assigned to this organization.",
        variant: "destructive",
      })
      return
    }

    const assignmentsPayload = targetIds.map((id) => ({
      productId: id,
      customPrice: assignmentDraft[id]?.customPrice || null,
    }))

    try {
      const response = await fetch("/api/v1/admin/organization-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organizationFilter,
          isActive: true,
          productIds: initialProductIds,
          assignments: assignmentsPayload,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Assignments created",
          description: result.message || `${targetIds.length} product(s) assigned successfully.`,
        })
        setInitialProductIds([])
        setShowAssignDialog(false)
        await mutateAssignments()
        // After creating assignments from a deep-link, normalize the URL while preserving organization filter
        const qs = new URLSearchParams()
        if (organizationFilter) {
          qs.set("organizationId", organizationFilter)
        }
        router.replace(`/organization-assignments${qs.toString() ? `?${qs.toString()}` : ""}`)
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create assignments",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating assignments:", error)
      toast({
        title: "Error",
        description: "Failed to create assignments",
        variant: "destructive",
      })
    }
  }

  // Auto-open edit dialog when deep-linked with a specific productId
  useEffect(() => {
    if (!productFilter || editingAssignment || showAssignDialog || hasAutoOpenedEdit) return
    if (!filteredAssignments.length) return

    const match =
      filteredAssignments.find((a) => String(a.globalProductId) === productFilter) ||
      filteredAssignments[0]
    if (match) {
      openEditDialog(match)
      setHasAutoOpenedEdit(true)
    }
  }, [productFilter, filteredAssignments, editingAssignment, showAssignDialog, hasAutoOpenedEdit])

  // Calculate summary stats
  const totalAssignments = assignments?.total || 0
  const activeAssignments = useMemo(() => {
    if (!assignments?.items) return 0
    return assignments.items.filter(a => a.isActive).length
  }, [assignments?.items])

  const uniqueOrganizations = useMemo(() => {
    if (!assignments?.items) return 0
    const orgIds = new Set(assignments.items.map(a => a.organizationId))
    return orgIds.size
  }, [assignments?.items])

  const handleRemoveAssignment = async (assignmentId: number) => {
    try {
      const response = await fetch(`/api/v1/admin/organization-assignments?id=${assignmentId}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        })
        mutateAssignments()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to remove assignment",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error removing assignment:", error)
      toast({
        title: "Error",
        description: "Failed to remove assignment",
        variant: "destructive",
      })
    }
  }

  const handleBulkRemove = async () => {
    if (selectedAssignments.length === 0) {
      toast({
        title: "No Assignments Selected",
        description: "Please select assignments to remove",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/v1/admin/organization-assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: selectedAssignments,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        })
        setSelectedAssignments([])
        setShowRemoveDialog(false)
        mutateAssignments()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to remove assignments",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error removing assignments:", error)
      toast({
        title: "Error",
        description: "Failed to remove assignments",
        variant: "destructive",
      })
    }
  }

  const toggleAssignmentSelection = (assignmentId: number) => {
    setSelectedAssignments(prev => 
      prev.includes(assignmentId) 
        ? prev.filter(id => id !== assignmentId)
        : [...prev, assignmentId]
    )
  }

  const selectAllAssignments = () => {
    setSelectedAssignments(
      selectedAssignments.length === filteredAssignments.length 
        ? [] 
        : filteredAssignments.map(a => a.id)
    )
  }

  const openEditDialog = (assignment: OrganizationAssignment) => {
    setEditingAssignment(assignment)
    setEditForm({
      isActive: assignment.isActive,
      customName: assignment.customName || "",
      customPrice: assignment.customPrice ? (assignment.customPrice / 100).toString() : "",
      customDescription: assignment.customDescription || "",
      customImageUrl: assignment.customImageUrl || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingAssignment) return
    setIsSavingEdit(true)
    try {
      const response = await fetch("/api/v1/admin/organization-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAssignment.id,
          isActive: editForm.isActive,
          customName: editForm.customName || null,
          customPrice: editForm.customPrice || null,
          customDescription: editForm.customDescription || null,
          customImageUrl: editForm.customImageUrl || null,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Assignment updated",
          description: result.message || "Overrides have been updated for this organization.",
        })
        setEditingAssignment(null)
        await mutateAssignments()
        // Clean up deep-link query while preserving organization filter
        const qs = new URLSearchParams()
        if (organizationFilter) {
          qs.set("organizationId", organizationFilter)
        }
        router.replace(`/organization-assignments${qs.toString() ? `?${qs.toString()}` : ""}`)
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update assignment",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating assignment:", error)
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive",
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Organization Assignments"
        subtitle="Manage which products are assigned to which organizations, and edit organization-specific overrides."
      />

      {/* Dedicated assignment dialog when coming from 'Assign selected' */}
      <Dialog
        open={!!organizationFilter && initialProductIds.length > 0 && showAssignDialog}
        onOpenChange={(open) => {
          setShowAssignDialog(open)
          if (!open) {
            setInitialProductIds([])
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Assign {initialProductIds.length} product{initialProductIds.length !== 1 ? "s" : ""} to{" "}
              {organizations.find((o) => String(o.id) === organizationFilter)?.name || "organization"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Review the selected products and optionally set custom prices before creating assignments. Products that
              are already assigned will be shown as read-only.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 max-h-80 overflow-y-auto rounded-md border bg-muted/30">
            <Table>
              <thead>
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Global price</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Custom price (PKR)</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedProductsForAssignment.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-sm text-muted-foreground text-center">
                      Selected products could not be loaded from global inventory.
                    </td>
                  </tr>
                ) : (
                  selectedProductsForAssignment.map((product) => {
                    const isAlreadyAssigned = existingProductIds.has(product.id)
                    const draft = assignmentDraft[product.id] || { customPrice: "" }
                    return (
                      <tr key={product.id} className="border-t">
                        <td className="p-3 text-sm">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">{product.productCode}</div>
                        </td>
                        <td className="p-3 text-sm">{formatPKR(product.basePrice / 100)}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={draft.customPrice}
                            onChange={(e) =>
                              setAssignmentDraft((prev) => ({
                                ...prev,
                                [product.id]: { customPrice: e.target.value },
                              }))
                            }
                            placeholder="Leave blank to use global price"
                            className="h-8 text-sm"
                            disabled={isAlreadyAssigned}
                          />
                        </td>
                        <td className="p-3 text-xs">
                          {isAlreadyAssigned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                              Already assigned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Ready to assign
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false)
                setInitialProductIds([])
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateAssignments}>
              Create assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assignments</p>
              <p className="text-2xl font-bold">{totalAssignments}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Assignments</p>
              <p className="text-2xl font-bold">{activeAssignments}</p>
            </div>
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Organizations</p>
              <p className="text-2xl font-bold">{uniqueOrganizations}</p>
            </div>
            <Building2 className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Selected</p>
              <p className="text-2xl font-bold">{selectedAssignments.length}</p>
            </div>
            <Eye className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <select
            value={organizationFilter}
            onChange={(e) => setOrganizationFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Organizations</option>
            {organizations && Array.isArray(organizations) ? organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            )) : (
              <option value="" disabled>Loading organizations...</option>
            )}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {selectedAssignments.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setShowRemoveDialog(true)}
            >
              <Trash2 size={16} className="mr-2" />
              Remove Selected ({selectedAssignments.length})
            </Button>
          )}
        </div>
      </div>

      {/* Assignments Table */}
      <Card>
        <Table>
          <thead>
            <tr>
              <th className="text-left p-4 font-medium w-12">
                <input
                  type="checkbox"
                  checked={selectedAssignments.length === filteredAssignments.length && filteredAssignments.length > 0}
                  onChange={selectAllAssignments}
                  className="rounded"
                />
              </th>
              <th className="text-left p-4 font-medium">Product</th>
              <th className="text-left p-4 font-medium">Organization</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Custom Name</th>
              <th className="text-left p-4 font-medium">Custom Price</th>
              <th className="text-left p-4 font-medium">Assigned Date</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignmentsLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  Loading assignments...
                </td>
              </tr>
            ) : filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  No assignments found
                </td>
              </tr>
            ) : (
              filteredAssignments.map(assignment => (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedAssignments.includes(assignment.id)}
                      onChange={() => toggleAssignmentSelection(assignment.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {assignment.productImageUrl ? (
                        <img
                          src={assignment.productImageUrl}
                          alt={assignment.productName}
                          className="w-12 h-12 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{assignment.productName}</div>
                        <div className="text-xs text-gray-500">{assignment.productCode}</div>
                        <div className="text-[11px] text-gray-400">
                          Product ID: <span className="font-mono">{assignment.globalProductId}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">{assignment.organizationName}</div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={assignment.isActive ? "default" : "secondary"}
                      className={assignment.isActive ? "bg-green-100 text-green-800" : ""}
                    >
                      {assignment.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      {assignment.customName || (
                        <span className="text-gray-400 italic">No override</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      {assignment.customPrice ? (
                        formatPKR(assignment.customPrice / 100)
                      ) : (
                        <span className="text-gray-400 italic">No override</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-600">
                      {new Date(assignment.assignedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(assignment)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Remove Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={() => setShowRemoveDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Assignments</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedAssignments.length} assignment(s)? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkRemove}>
              Remove Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog
        open={!!editingAssignment}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAssignment(null)
            setHasAutoOpenedEdit(true) // prevent any re-auto-open for this load
            setProductFilter("") // stop productId-based auto targeting
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit organization override</DialogTitle>
            <DialogDescription>
              Adjust the organization-specific details for this product. Core product data remains read-only.
            </DialogDescription>
          </DialogHeader>

          {editingAssignment && (
            <div className="space-y-4">
              {/* Read-only context */}
              <Card className="p-3">
                <div className="flex items-center gap-3">
                  {editingAssignment.productImageUrl ? (
                    <img
                      src={editingAssignment.productImageUrl}
                      alt={editingAssignment.productName}
                      className="w-12 h-12 rounded-md object-cover border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md border bg-gray-50 flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold">{editingAssignment.productName}</div>
                    <div className="text-xs text-gray-500">{editingAssignment.productCode}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Organization: <span className="font-medium">{editingAssignment.organizationName}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Editable overrides */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Assignment active</label>
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Custom name</label>
                  <Input
                    value={editForm.customName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, customName: e.target.value }))}
                    placeholder="Optional display name for this organization"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Custom price (PKR)</label>
                  {(() => {
                    const product = productsData?.items?.find(p => p.id === editingAssignment.globalProductId)
                    const basePrice = product?.basePrice ? formatPKR(product.basePrice / 100) : "N/A"
                    return (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Global base price: <span className="font-medium">{basePrice}</span>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.customPrice}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, customPrice: e.target.value }))}
                          placeholder="Leave blank to use global price"
                        />
                      </div>
                    )
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Custom description</label>
                  <Input
                    value={editForm.customDescription}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, customDescription: e.target.value }))}
                    placeholder="Optional description override"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Custom image URL</label>
                  <Input
                    value={editForm.customImageUrl}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, customImageUrl: e.target.value }))}
                    placeholder="Optional image URL override"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAssignment(null)}
                  disabled={isSavingEdit}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                  {isSavingEdit ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
