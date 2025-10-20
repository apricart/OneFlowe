"use client"
import React, { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { 
  Package, 
  Search, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Check,
  X
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface BranchProduct {
  id: number
  branchId: number
  organizationId: number
  globalProductId: number
  organizationProductId: number
  isVisible: boolean
  isAvailable: boolean
  stockQuantity: number
  reservedQuantity: number
  reorderThreshold: number
  reorderQuantity: number
  lastRestockDate: string | null
  customNotes: string | null
  createdAt: string
  updatedAt: string
  productName: string
  productCode: string
  productImageUrl: string | null
  categoryName: string | null
  basePrice: number
  unit: string
  customName: string | null
  customPrice: number | null
  customDescription: string | null
}

export default function BranchAdminInventory({
  organizationId,
  branchId
}: {
  organizationId: number
  branchId: number
}) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState("all")

  // Fetch branch products with visibility data
  const { data, error, isLoading, mutate } = useSWR<{
    items: BranchProduct[]
  }>(
    `/api/v1/inventory/branch-visibility?branchId=${branchId}&organizationId=${organizationId}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const products = data?.items || []

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products
    
    if (visibilityFilter === "visible") {
      filtered = filtered.filter(p => p.isVisible)
    } else if (visibilityFilter === "hidden") {
      filtered = filtered.filter(p => !p.isVisible)
    }
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    return filtered
  }, [products, visibilityFilter, searchQuery])

  // Calculate summary stats
  const totalProducts = products.length
  const visibleProducts = products.filter(p => p.isVisible).length
  const hiddenProducts = products.filter(p => !p.isVisible).length
  const lowStockProducts = products.filter(p => p.stockQuantity <= p.reorderThreshold).length

  const handleToggleVisibility = async (branchProductId: number, isVisible: boolean) => {
    try {
      const response = await fetch("/api/v1/inventory/branch-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationProductId: branchProductId,
          branchId: branchId,
          isVisible
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Product ${isVisible ? 'shown' : 'hidden'} successfully`,
        })
        mutate()
      } else {
        const result = await response.json()
        toast({
          title: "Error",
          description: result.error || "Failed to update visibility",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating visibility:", error)
      toast({
        title: "Error",
        description: "Failed to update visibility",
        variant: "destructive",
      })
    }
  }

  const handleBulkVisibilityToggle = async (productIds: number[], isVisible: boolean) => {
    try {
      const response = await fetch("/api/v1/inventory/branch-visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationProductIds: productIds,
          branchIds: [branchId],
          isVisible
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `${productIds.length} products ${isVisible ? 'shown' : 'hidden'} successfully`,
        })
        mutate()
      } else {
        const result = await response.json()
        toast({
          title: "Error",
          description: result.error || "Failed to update visibility",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating bulk visibility:", error)
      toast({
        title: "Error",
        description: "Failed to update visibility",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading products...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">Failed to load products</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Branch Inventory"
        subtitle="Manage product visibility and stock for your branch"
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
              <p className="text-sm font-medium text-gray-600">Hidden Products</p>
              <p className="text-2xl font-bold">{hiddenProducts}</p>
            </div>
            <EyeOff className="h-8 w-8 text-gray-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold">{lowStockProducts}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Product Visibility Management */}
      <Card>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Product Visibility</h3>
            <div className="flex gap-2">
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
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <th className="text-left p-4 font-medium">Product</th>
              <th className="text-left p-4 font-medium">Price</th>
              <th className="text-left p-4 font-medium">Stock</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-center p-4 font-medium">Visibility</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No products found
                </td>
              </tr>
            ) : (
              filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {product.productImageUrl ? (
                        <img
                          src={product.productImageUrl}
                          alt={product.productName}
                          className="w-12 h-12 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{product.customName || product.productName}</div>
                        <div className="text-xs text-gray-500">{product.productCode}</div>
                        <div className="text-xs text-gray-500">{product.categoryName || "No Category"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium">
                      ${((product.customPrice || product.basePrice) / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">{product.unit}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <span className={product.stockQuantity <= product.reorderThreshold ? "text-orange-600 font-medium" : ""}>
                        {product.stockQuantity}
                      </span>
                      {product.stockQuantity <= product.reorderThreshold && (
                        <span className="text-xs text-orange-600 ml-1">(Low Stock)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Threshold: {product.reorderThreshold}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={product.isAvailable ? "default" : "secondary"}
                        className={product.isAvailable ? "bg-green-100 text-green-800" : ""}
                      >
                        {product.isAvailable ? "Available" : "Unavailable"}
                      </Badge>
                      {product.stockQuantity <= product.reorderThreshold && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Low Stock
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <Switch
                      checked={product.isVisible}
                      onCheckedChange={(checked) => 
                        handleToggleVisibility(product.organizationProductId, checked)
                      }
                    />
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleVisibility(product.organizationProductId, !product.isVisible)}
                      >
                        {product.isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Bulk Actions */}
      {filteredProducts.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {filteredProducts.length} products available
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkVisibilityToggle(
                  filteredProducts.map(p => p.organizationProductId), 
                  true
                )}
              >
                <Eye size={14} className="mr-2" />
                Show All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkVisibilityToggle(
                  filteredProducts.map(p => p.organizationProductId), 
                  false
                )}
              >
                <EyeOff size={14} className="mr-2" />
                Hide All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Information Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Branch Visibility Control</h4>
            <p className="text-sm text-blue-700 mt-1">
              You can control which products are visible to customers in your branch. 
              Hidden products won't appear in customer-facing interfaces but will still be tracked in inventory.
              Stock levels and availability are managed by Head Office.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}