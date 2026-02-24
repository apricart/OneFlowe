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
  X,
  Filter
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  // Stock & reorder fields no longer used – kept out of UI
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
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [visibilityFilter, setVisibilityFilter] = useState("all")

  // Fetch categories
  const { data: categoriesData } = useSWR<{ items: { id: number; name: string }[] }>("/api/v1/categories", fetcher)
  const categories = categoriesData?.items || []

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

    if (categoryFilter !== "all") {
      filtered = filtered.filter(p => p.categoryName === categories.find(c => String(c.id) === categoryFilter)?.name)
    }

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [products, visibilityFilter, searchQuery, categoryFilter, categories])

  // Calculate summary stats
  const totalProducts = products.length
  const visibleProducts = products.filter(p => p.isVisible).length
  const hiddenProducts = products.filter(p => !p.isVisible).length
  const lowStockProducts = 0

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <p className="text-sm font-medium text-gray-600">Available Products</p>
              <p className="text-2xl font-bold">{visibleProducts}</p>
            </div>
            <Check className="h-8 w-8 text-green-600" />
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="All Categories" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <th className="text-left p-4 font-medium">Product</th>
              <th className="text-left p-4 font-medium">Unit Price</th>
              <th className="text-left p-4 font-medium">Stock</th>
              <th className="text-right p-4 font-medium">Status</th>
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
                    <div className="text-sm text-gray-500">
                      N/A
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col gap-1 items-end">
                      <Badge
                        variant={product.isAvailable ? "default" : "secondary"}
                        className={product.isAvailable ? "bg-green-100 text-green-800" : ""}
                      >
                        {product.isAvailable ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

    </div>
  )
}