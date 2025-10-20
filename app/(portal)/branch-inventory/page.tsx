"use client"

import React, { useState, useMemo } from "react"
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
  Package,
  Eye,
  EyeOff,
  Settings,
  AlertTriangle,
  CheckCircle,
  Lock,
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"
import { StockStatusBadge } from "@/components/inventory/stock-status-badge"
import { FieldSourceBadge } from "@/components/inventory/field-source-badge"
import { ProductDetailCard } from "@/components/inventory/product-detail-card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InventoryTableSkeleton } from "@/components/inventory/inventory-table-skeleton"
import { EmptyInventoryState } from "@/components/inventory/empty-inventory-state"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface BranchInventoryItem {
  id: number
  branchId: number
  organizationId: number
  organizationInventoryId: number
  isVisible: boolean
  isActive: boolean
  stockQuantity: number
  reorderThreshold: number
  assignedAt: string
  updatedAt: string
  // Effective product data (org override or global default)
  productName: string
  productCode: string
  productImageUrl?: string
  basePrice: number
  unit: string
  status: string
  categoryName?: string
  // Organization overrides (for source attribution)
  customName?: string
  customPrice?: number
  customDescription?: string
  customImageUrl?: string
}

export default function BranchInventoryPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState("all")
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<BranchInventoryItem | null>(null)

  // Edit form data
  const [editData, setEditData] = useState({
    isVisible: true,
    stockQuantity: 0,
    reorderThreshold: 10,
  })

  // Fetch data
  const { data: inventory, error: inventoryError, isLoading: inventoryLoading, mutate: mutateInventory } = useSWR<{
    items: BranchInventoryItem[]
    total: number
  }>(`/api/v1/branch/inventory?search=${searchQuery}&visibility=${visibilityFilter}`, fetcher, {
    fallbackData: { items: [], total: 0 }
  })

  // Filter inventory
  const filteredInventory = useMemo(() => {
    if (!inventory?.items) return []
    return inventory.items
  }, [inventory?.items])

  // Calculate summary stats
  const totalProducts = inventory?.total || 0
  const visibleProducts = useMemo(() => {
    if (!inventory?.items) return 0
    return inventory.items.filter(item => item.isVisible).length
  }, [inventory?.items])

  const lowStockProducts = useMemo(() => {
    if (!inventory?.items) return 0
    return inventory.items.filter(item => item.stockQuantity <= item.reorderThreshold).length
  }, [inventory?.items])

  const outOfStockProducts = useMemo(() => {
    if (!inventory?.items) return 0
    return inventory.items.filter(item => item.stockQuantity === 0).length
  }, [inventory?.items])

  const handleEditItem = (item: BranchInventoryItem) => {
    setEditData({
      isVisible: item.isVisible,
      stockQuantity: item.stockQuantity,
      reorderThreshold: item.reorderThreshold,
    })
    setEditingItem(item)
    setShowEditDialog(true)
  }

  const handleSubmitEdit = async () => {
    if (!editingItem) return

    try {
      const response = await fetch("/api/v1/branch/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          isVisible: editData.isVisible,
          stockQuantity: editData.stockQuantity,
          reorderThreshold: editData.reorderThreshold,
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

  const getStockStatus = (item: BranchInventoryItem) => {
    if (item.stockQuantity === 0) {
      return { status: "out", color: "text-red-600", icon: AlertTriangle }
    } else if (item.stockQuantity <= item.reorderThreshold) {
      return { status: "low", color: "text-yellow-600", icon: AlertTriangle }
    } else {
      return { status: "good", color: "text-green-600", icon: CheckCircle }
    }
  }

  return (
    <TooltipProvider>
    <div className="space-y-6 overflow-x-hidden max-w-full">
      <SectionHeader
        title="Branch Inventory Management"
        subtitle="Manage product visibility and stock levels for your branch"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Visible Products</p>
              <p className="text-2xl font-bold">{visibleProducts}</p>
            </div>
            <Eye className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold">{lowStockProducts}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold">{outOfStockProducts}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
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
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Products</option>
          <option value="visible">Visible Only</option>
          <option value="hidden">Hidden Only</option>
        </select>
      </div>

      {/* Inventory Table */}
      <Card className="max-w-full">
        <div className="overflow-x-auto">
        <Table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-4 font-medium">Product</th>
              <th className="text-left p-4 font-medium">Category</th>
              <th className="text-left p-4 font-medium">Price</th>
              <th className="text-left p-4 font-medium">Visibility</th>
              <th className="text-left p-4 font-medium">Stock Level</th>
              <th className="text-left p-4 font-medium">Reorder Threshold</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventoryLoading ? (
              <tr>
                <td colSpan={8} className="p-8">
                  <InventoryTableSkeleton rows={3} columns={8} />
                </td>
              </tr>
            ) : filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-0">
                  <EmptyInventoryState
                    title="No Products Assigned"
                    description="No products have been assigned to your branch yet. Contact Head Office to request product assignments."
                  />
                </td>
              </tr>
            ) : (
              filteredInventory.map(item => {
                const stockStatus = getStockStatus(item)
                const StockIcon = stockStatus.icon
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-3">
                        {item.customImageUrl || item.productImageUrl ? (
                          <img
                            src={item.customImageUrl || item.productImageUrl}
                            alt={item.productName}
                            className="w-12 h-12 object-cover rounded-lg border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium break-words">
                            {item.customName || item.productName}
                          </div>
                          <div className="text-xs text-gray-500 break-words">{item.productCode}</div>
                          <div className="mt-1">
                            <FieldSourceBadge 
                              source={item.customName ? "organization" : "global"} 
                              field="name" 
                            />
                          </div>
                          {item.customDescription && (
                            <div className="text-xs text-gray-400 line-clamp-1 break-words">
                              {item.customDescription}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge variant="outline">
                        {item.categoryName || "No Category"}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">
                          ${((item.customPrice || item.basePrice) / 100).toFixed(2)} {item.unit}
                        </span>
                        <div className="text-xs">
                          <FieldSourceBadge 
                            source={item.customPrice ? "organization" : "global"} 
                            field="price" 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge
                        variant={item.isVisible ? "default" : "secondary"}
                        className={item.isVisible ? "bg-green-100 text-green-800" : ""}
                      >
                        {item.isVisible ? "Visible" : "Hidden"}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <StockStatusBadge 
                        quantity={item.stockQuantity}
                        threshold={item.reorderThreshold}
                        showIcon={true}
                      />
                    </td>
                    <td className="p-4 align-middle">
                      <div className="text-sm">{item.reorderThreshold}</div>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge
                        variant={item.isActive ? "default" : "secondary"}
                        className={item.isActive ? "bg-blue-100 text-blue-800" : ""}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right align-middle">
                      <div className="flex items-center gap-2 justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditItem(item)}
                        >
                          <Settings size={14} />
                        </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit stock and visibility settings</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
        </div>
      </Card>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={() => setShowEditDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Product Settings</DialogTitle>
            <DialogDescription>
              Manage visibility and stock levels for this product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingItem && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  {editingItem.customImageUrl || editingItem.productImageUrl ? (
                    <img
                      src={editingItem.customImageUrl || editingItem.productImageUrl}
                      alt={editingItem.productName}
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
                      {editingItem.customName || editingItem.productName}
                      </span>
                      <FieldSourceBadge 
                        source={editingItem.customName ? "organization" : "global"} 
                        field="name" 
                      />
                    </div>
                    <div className="text-xs text-gray-500">{editingItem.productCode}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold">
                        ${((editingItem.customPrice || editingItem.basePrice) / 100).toFixed(2)} {editingItem.unit}
                      </span>
                      <FieldSourceBadge 
                        source={editingItem.customPrice ? "organization" : "global"} 
                        field="price" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isVisible"
                checked={editData.isVisible}
                onChange={(e) => setEditData({ ...editData, isVisible: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isVisible" className="text-sm font-medium">
                Make this product visible to customers
              </label>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span>You can control product visibility</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Current Stock Quantity</label>
              <Input
                type="number"
                value={editData.stockQuantity}
                onChange={(e) => setEditData({ ...editData, stockQuantity: parseInt(e.target.value) || 0 })}
                placeholder="0"
                min="0"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span>You can manage stock levels</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Reorder Threshold</label>
              <Input
                type="number"
                value={editData.reorderThreshold}
                onChange={(e) => setEditData({ ...editData, reorderThreshold: parseInt(e.target.value) || 10 })}
                placeholder="10"
                min="0"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span>You'll be notified when stock falls below this level</span>
              </div>
            </div>

            {editingItem && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Field Restrictions:</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Product name, price, description, and image are managed by Head Office</li>
                      <li>• You can only control visibility, stock quantity, and reorder threshold</li>
                      <li>• Changes to product details require Head Office approval</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
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
    </div>
    </TooltipProvider>
  )
}
