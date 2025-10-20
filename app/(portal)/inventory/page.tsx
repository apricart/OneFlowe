"use client"

import React, { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
  Package,
  Building2,
  Share2,
  Check,
  Eye,
  EyeOff,
  Settings,
  Plus,
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"
import { OverrideIndicator } from "@/components/inventory/override-indicator"
import { useAppContext } from "@/components/context/app-context"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface OrganizationInventoryItem {
  id: number
  organizationId: number
  globalProductId: number
  isActive: boolean
  customName?: string
  customPrice?: number
  customDescription?: string
  customImageUrl?: string
  assignedAt: string
  updatedAt: string
  productName: string
  productCode: string
  productImageUrl?: string
  basePrice: number
  unit: string
  status: string
  categoryName?: string
}

interface BranchAssignment {
  id: number
  branchId: number
  organizationId: number
  organizationInventoryId: number
  globalProductId: number
  isVisible: boolean
  isActive: boolean
  stockQuantity: number
  reorderThreshold: number
  assignedAt: string
  updatedAt: string
  productName: string
  productCode: string
  productImageUrl?: string
  basePrice: number
  unit: string
  branchName: string
  customName?: string
  customPrice?: number
}

interface Branch {
  id: number
  name: string
  address?: string
  organizationId: number
  createdAt: string
}

export default function HeadOfficeInventoryPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [showBranchAssignmentDialog, setShowBranchAssignmentDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<OrganizationInventoryItem | null>(null)
  const [activeTab, setActiveTab] = useState("inventory")

  // Assignment form data
  const [assignmentData, setAssignmentData] = useState({
    organizationInventoryIds: [] as number[],
    branchIds: [] as number[],
    isVisible: true,
    isActive: true,
    stockQuantity: 0,
    reorderThreshold: 10,
  })

  // Edit form data
  const [editData, setEditData] = useState({
    isActive: true,
    customName: "",
    customPrice: "",
    customDescription: "",
    customImageUrl: "",
  })

  // Get organization context for Super Admin
  const { organizationId } = useAppContext()

  // Fetch data
  const { data: inventory, error: inventoryError, isLoading: inventoryLoading, mutate: mutateInventory } = useSWR<{
    items: OrganizationInventoryItem[]
    total: number
  }>(`/api/v1/head-office/organization-inventory?search=${searchQuery}&status=${statusFilter}${organizationId ? `&organizationId=${organizationId}` : ''}`, fetcher, {
    fallbackData: { items: [], total: 0 }
  })

  const { data: branchesResp, error: branchesError } = useSWR<{ items: Branch[] }>(`/api/v1/branches${organizationId ? `?organizationId=${organizationId}` : ''}`, fetcher, {
    fallbackData: { items: [] }
  })
  const branches = branchesResp?.items || []

  const { data: assignments, error: assignmentsError, isLoading: assignmentsLoading, mutate: mutateAssignments } = useSWR<{
    items: BranchAssignment[]
    total: number
  }>(`/api/v1/head-office/branch-assignments${organizationId ? `?organizationId=${organizationId}` : ''}`, fetcher, {
    fallbackData: { items: [], total: 0 }
  })

  // Filter inventory
  const filteredInventory = useMemo(() => {
    if (!inventory?.items) return []
    return inventory.items
  }, [inventory?.items])

  // Calculate summary stats
  const totalProducts = inventory?.total || 0
  const activeProducts = useMemo(() => {
    if (!inventory?.items) return 0
    return inventory.items.filter(item => item.isActive).length
  }, [inventory?.items])

  const totalBranches = branches.length || 0
  const branchesWithProducts = useMemo(() => {
    if (!assignments?.items) return 0
    const branchIds = new Set(assignments.items.map(a => a.branchId))
    return branchIds.size
  }, [assignments?.items])

  const handleEditItem = (item: OrganizationInventoryItem) => {
    setEditData({
      isActive: item.isActive,
      customName: item.customName || "",
      customPrice: item.customPrice ? (item.customPrice / 100).toFixed(2) : "",
      customDescription: item.customDescription || "",
      customImageUrl: item.customImageUrl || "",
    })
    setEditingItem(item)
    setShowEditDialog(true)
  }

  const handleSubmitEdit = async () => {
    if (!editingItem) return

    try {
      const response = await fetch("/api/v1/head-office/organization-inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          isActive: editData.isActive,
          customName: editData.customName || null,
          customPrice: editData.customPrice ? parseFloat(editData.customPrice) : null,
          customDescription: editData.customDescription || null,
          customImageUrl: editData.customImageUrl || null,
          ...(organizationId && { organizationId })
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        })
        setShowEditDialog(false)
        mutateInventory()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update inventory",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating inventory:", error)
      toast({
        title: "Error",
        description: "Failed to update inventory",
        variant: "destructive",
      })
    }
  }

  const handleBranchAssignment = (item: OrganizationInventoryItem) => {
    setAssignmentData({
      organizationInventoryIds: [item.id],
      branchIds: [],
      isVisible: true,
      isActive: true,
      stockQuantity: 0,
      reorderThreshold: 10,
    })
    setShowBranchAssignmentDialog(true)
  }

  const handleBulkBranchAssignment = () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select products to assign",
        variant: "destructive",
      })
      return
    }
    setAssignmentData({
      organizationInventoryIds: selectedProducts,
      branchIds: [],
      isVisible: true,
      isActive: true,
      stockQuantity: 0,
      reorderThreshold: 10,
    })
    setShowBranchAssignmentDialog(true)
  }

  const handleSubmitBranchAssignment = async () => {
    if (assignmentData.branchIds.length === 0) {
      toast({
        title: "Branches Required",
        description: "Please select at least one branch",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/v1/head-office/branch-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...assignmentData,
          ...(organizationId && { organizationId })
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        })
        setShowBranchAssignmentDialog(false)
        setAssignmentData({
          organizationInventoryIds: [],
          branchIds: [],
          isVisible: true,
          isActive: true,
          stockQuantity: 0,
          reorderThreshold: 10,
        })
        mutateAssignments()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to assign products",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error assigning products:", error)
      toast({
        title: "Error",
        description: "Failed to assign products",
        variant: "destructive",
      })
    }
  }

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const selectAllProducts = () => {
    setSelectedProducts(
      selectedProducts.length === filteredInventory.length 
        ? [] 
        : filteredInventory.map(p => p.id)
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Organization Inventory Management"
        subtitle="Manage products assigned to your organization and control branch visibility"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Assigned Products</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Products</p>
              <p className="text-2xl font-bold">{activeProducts}</p>
            </div>
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Branches</p>
              <p className="text-2xl font-bold">{totalBranches}</p>
            </div>
            <Building2 className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Branches with Products</p>
              <p className="text-2xl font-bold">{branchesWithProducts}</p>
            </div>
            <Share2 className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inventory">Organization Inventory</TabsTrigger>
          <TabsTrigger value="assignments">Branch Assignments</TabsTrigger>
          <TabsTrigger value="overview">Inventory Overview</TabsTrigger>
        </TabsList>

        {/* Organization Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
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
              {selectedProducts.length > 0 && (
                <Button onClick={handleBulkBranchAssignment}>
                  <Share2 size={16} className="mr-2" />
                  Assign to Branches ({selectedProducts.length})
                </Button>
              )}
            </div>
          </div>

          <Card>
            <Table>
              <thead>
                <tr>
                  <th className="text-left p-4 font-medium w-12">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredInventory.length && filteredInventory.length > 0}
                      onChange={selectAllProducts}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left p-4 font-medium">Product</th>
                  <th className="text-left p-4 font-medium">Category</th>
                  <th className="text-left p-4 font-medium">Price</th>
                  <th className="text-left p-4 font-medium">Custom Override</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Assigned Date</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventoryLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No products assigned to your organization
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(item.id)}
                          onChange={() => toggleProductSelection(item.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {item.productImageUrl ? (
                            <img
                              src={item.productImageUrl}
                              alt={item.productName}
                              className="w-12 h-12 object-cover rounded-lg border"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {item.customName || item.productName}
                              </span>
                              <OverrideIndicator
                                field="name"
                                globalValue={item.productName}
                                customValue={item.customName}
                                isOverridden={!!item.customName}
                              />
                            </div>
                            <div className="text-xs text-gray-500">{item.productCode}</div>
                            {item.customDescription && (
                              <div className="text-xs text-gray-400 line-clamp-1">
                                {item.customDescription}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">
                          {item.categoryName || "No Category"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <OverrideIndicator
                          field="price"
                          globalValue={item.basePrice}
                          customValue={item.customPrice}
                          isOverridden={!!item.customPrice}
                        />
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {item.customPrice ? `$${(item.customPrice / 100).toFixed(2)}` : "-"}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={item.isActive ? "default" : "secondary"}
                          className={item.isActive ? "bg-green-100 text-green-800" : ""}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-600">
                          {new Date(item.assignedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                          >
                            <Settings size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBranchAssignment(item)}
                          >
                            <Share2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card>
        </TabsContent>

        {/* Branch Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Branch Assignments</h3>
          </div>

          <Card>
            <Table>
              <thead>
                <tr>
                  <th className="text-left p-4 font-medium">Product</th>
                  <th className="text-left p-4 font-medium">Branch</th>
                  <th className="text-left p-4 font-medium">Visibility</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Stock</th>
                  <th className="text-left p-4 font-medium">Reorder Threshold</th>
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
                ) : assignments?.items?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No branch assignments found
                    </td>
                  </tr>
                ) : (
                  assignments?.items?.map(assignment => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
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
                            <div className="font-medium">
                              {assignment.customName || assignment.productName}
                            </div>
                            <div className="text-xs text-gray-500">{assignment.productCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium">{assignment.branchName}</div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={assignment.isVisible ? "default" : "secondary"}
                          className={assignment.isVisible ? "bg-green-100 text-green-800" : ""}
                        >
                          {assignment.isVisible ? "Visible" : "Hidden"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={assignment.isActive ? "default" : "secondary"}
                          className={assignment.isActive ? "bg-blue-100 text-blue-800" : ""}
                        >
                          {assignment.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {assignment.stockQuantity} {assignment.unit}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">{assignment.reorderThreshold}</div>
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
                            onClick={() => {
                              // Handle edit assignment
                            }}
                          >
                            <Settings size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card>
        </TabsContent>

        {/* Inventory Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Inventory Overview</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h4 className="font-semibold mb-4">Product Distribution</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Products</span>
                  <span className="font-medium">{totalProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Products</span>
                  <span className="font-medium text-green-600">{activeProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Inactive Products</span>
                  <span className="font-medium text-gray-600">{totalProducts - activeProducts}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h4 className="font-semibold mb-4">Branch Coverage</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Branches</span>
                  <span className="font-medium">{totalBranches}</span>
                </div>
                <div className="flex justify-between">
                  <span>Branches with Products</span>
                  <span className="font-medium text-blue-600">{branchesWithProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Coverage</span>
                  <span className="font-medium">
                    {totalBranches > 0 ? Math.round((branchesWithProducts / totalBranches) * 100) : 0}%
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={() => setShowEditDialog(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product Override</DialogTitle>
            <DialogDescription>
              Customize how this product appears in your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editData.isActive}
                onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Enable this product
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Custom Name (Optional)</label>
              <Input
                value={editData.customName}
                onChange={(e) => setEditData({ ...editData, customName: e.target.value })}
                placeholder="Override product name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Custom Price (Optional)</label>
              <Input
                type="number"
                step="0.01"
                value={editData.customPrice}
                onChange={(e) => setEditData({ ...editData, customPrice: e.target.value })}
                placeholder="Override price"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Custom Description (Optional)</label>
              <textarea
                value={editData.customDescription}
                onChange={(e) => setEditData({ ...editData, customDescription: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Override product description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Custom Image URL (Optional)</label>
              <Input
                value={editData.customImageUrl}
                onChange={(e) => setEditData({ ...editData, customImageUrl: e.target.value })}
                placeholder="Override product image"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Assignment Dialog */}
      <Dialog open={showBranchAssignmentDialog} onOpenChange={() => setShowBranchAssignmentDialog(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Products to Branches</DialogTitle>
            <DialogDescription>
              Select branches to assign the selected products to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium">Selected Products ({assignmentData.organizationInventoryIds.length})</h4>
              <div className="mt-2 max-h-32 overflow-y-auto">
                {assignmentData.organizationInventoryIds.map(inventoryId => {
                  const item = filteredInventory.find(i => i.id === inventoryId)
                  return item ? (
                    <div key={inventoryId} className="text-sm text-gray-600">
                      • {item.customName || item.productName} ({item.productCode})
                    </div>
                  ) : null
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Branches</label>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
                {branches && Array.isArray(branches) ? branches.map(branch => (
                  <div key={branch.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={`branch-${branch.id}`}
                      checked={assignmentData.branchIds.includes(branch.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignmentData({
                            ...assignmentData,
                            branchIds: [...assignmentData.branchIds, branch.id]
                          })
                        } else {
                          setAssignmentData({
                            ...assignmentData,
                            branchIds: assignmentData.branchIds.filter(id => id !== branch.id)
                          })
                        }
                      }}
                      className="rounded"
                    />
                    <label htmlFor={`branch-${branch.id}`} className="text-sm">
                      {branch.name}
                    </label>
                  </div>
                )) : (
                  <div className="text-sm text-gray-500">Loading branches...</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Initial Stock Quantity</label>
                <Input
                  type="number"
                  value={assignmentData.stockQuantity}
                  onChange={(e) => setAssignmentData({ ...assignmentData, stockQuantity: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Reorder Threshold</label>
                <Input
                  type="number"
                  value={assignmentData.reorderThreshold}
                  onChange={(e) => setAssignmentData({ ...assignmentData, reorderThreshold: parseInt(e.target.value) || 10 })}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={assignmentData.isVisible}
                  onChange={(e) => setAssignmentData({ ...assignmentData, isVisible: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isVisible" className="text-sm font-medium">
                  Make visible to branch
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={assignmentData.isActive}
                  onChange={(e) => setAssignmentData({ ...assignmentData, isActive: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Enable for branch
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBranchAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitBranchAssignment}>
              Assign to Branches
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}