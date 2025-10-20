"use client"
import React, { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Package, 
  Search, 
  Edit, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Building2, 
  MapPin,
  Check,
  X,
  AlertCircle
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface AssignedProduct {
  id: number
  productId: number
  organizationId: number
  isEnabled: boolean
  customName: string | null
  customPrice: number | null
  customDescription: string | null
  overrideLevel: string | null
  createdAt: string
  productName: string
  productCode: string
  productImageUrl: string | null
  categoryName: string | null
  basePrice: number
  unit: string
}

interface Branch {
  id: number
  name: string
  address: string | null
  isActive: boolean
}

interface BranchProduct {
  id: number
  branchId: number
  organizationId: number
  globalProductId: number
  organizationProductId: number
  isVisible: boolean
  isAvailable: boolean
  stockQuantity: number
  productName: string
  branchName: string
}

export default function HeadOfficeInventory({ organizationId }: { organizationId: number }) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [viewFilter, setViewFilter] = useState("all")
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState("assigned")
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false)
  const [selectedProductForVisibility, setSelectedProductForVisibility] = useState<AssignedProduct | null>(null)

  // Fetch assigned products
  const { data: assignedProducts, error: assignedError, isLoading: assignedLoading, mutate: mutateAssigned } = useSWR<{
    items: AssignedProduct[]
    total: number
  }>(`/api/v1/inventory/assignments?organizationId=${organizationId}`, fetcher)

  // Fetch branches for this organization
  const { data: branches, error: branchesError } = useSWR<Branch[]>(`/api/v1/branches?organizationId=${organizationId}`, fetcher)

  // Fetch branch visibility data
  const { data: branchVisibility, error: visibilityError, mutate: mutateVisibility } = useSWR<{
    items: BranchProduct[]
  }>(`/api/v1/inventory/branch-visibility?organizationId=${organizationId}`, fetcher)

  // Filter assigned products
  const filteredProducts = useMemo(() => {
    if (!assignedProducts?.items) return []
    
    let filtered = assignedProducts.items
    
    if (viewFilter === "active") {
      filtered = filtered.filter(p => p.isEnabled)
    } else if (viewFilter === "inactive") {
      filtered = filtered.filter(p => !p.isEnabled)
    }
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    return filtered
  }, [assignedProducts?.items, viewFilter, searchQuery])

  // Calculate summary stats
  const totalAssigned = assignedProducts?.total || 0
  const activeAssigned = useMemo(() => {
    if (!assignedProducts?.items) return 0
    return assignedProducts.items.filter(p => p.isEnabled).length
  }, [assignedProducts?.items])

  const totalBranches = branches?.length || 0
  const visibleProducts = useMemo(() => {
    if (!branchVisibility?.items) return 0
    return new Set(branchVisibility.items.filter(bp => bp.isVisible).map(bp => bp.globalProductId)).size
  }, [branchVisibility?.items])

  const handleToggleVisibility = async (organizationProductId: number, branchId: number, isVisible: boolean) => {
    try {
      const response = await fetch("/api/v1/inventory/branch-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationProductId,
          branchId,
          isVisible
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Product visibility ${isVisible ? 'enabled' : 'disabled'} for branch`,
        })
        mutateVisibility()
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
    if (!branches || branches.length === 0) {
      toast({
        title: "No Branches",
        description: "No branches available for this organization",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/v1/inventory/branch-visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationProductIds: productIds,
          branchIds: branches.map(b => b.id),
          isVisible
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Visibility ${isVisible ? 'enabled' : 'disabled'} for ${productIds.length} products across all branches`,
        })
        mutateVisibility()
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

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const selectAllProducts = () => {
    setSelectedProducts(
      selectedProducts.length === filteredProducts.length 
        ? [] 
        : filteredProducts.map(p => p.id)
    )
  }

  const getBranchVisibility = (organizationProductId: number, branchId: number) => {
    if (!branchVisibility?.items) return false
    const bp = branchVisibility.items.find(bp => 
      bp.organizationProductId === organizationProductId && bp.branchId === branchId
    )
    return bp?.isVisible ?? true // Default to visible if not found
  }

  const getVisibilityCount = (organizationProductId: number) => {
    if (!branchVisibility?.items || !branches) return 0
    return branchVisibility.items.filter(bp => 
      bp.organizationProductId === organizationProductId && bp.isVisible
    ).length
  }

  if (assignedLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading assigned products...</p>
        </div>
      </div>
    )
  }

  if (assignedError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">Failed to load assigned products</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Organization Inventory"
        subtitle="Manage products assigned to your organization and control branch visibility"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Assigned Products</p>
              <p className="text-2xl font-bold">{totalAssigned}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Products</p>
              <p className="text-2xl font-bold">{activeAssigned}</p>
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
            <MapPin className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Visible Products</p>
              <p className="text-2xl font-bold">{visibleProducts}</p>
            </div>
            <Eye className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assigned">Assigned Products</TabsTrigger>
          <TabsTrigger value="visibility">Branch Visibility</TabsTrigger>
        </TabsList>

        {/* Assigned Products Tab */}
        <TabsContent value="assigned" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Assigned Products</h3>
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
                value={viewFilter}
                onChange={(e) => setViewFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Products</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          <Card>
            <Table>
              <thead>
                <tr>
                  <th className="text-left p-4 font-medium w-12">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={selectAllProducts}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left p-4 font-medium">Product</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Custom Name</th>
                  <th className="text-left p-4 font-medium">Custom Price</th>
                  <th className="text-left p-4 font-medium">Override Level</th>
                  <th className="text-left p-4 font-medium">Visibility</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No assigned products found
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="rounded"
                        />
                      </td>
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
                            <div className="font-medium">{product.productName}</div>
                            <div className="text-xs text-gray-500">{product.productCode}</div>
                            <div className="text-xs text-gray-500">{product.categoryName || "No Category"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={product.isEnabled ? "default" : "secondary"}
                          className={product.isEnabled ? "bg-green-100 text-green-800" : ""}
                        >
                          {product.isEnabled ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">{product.customName || "-"}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {product.customPrice ? `$${(product.customPrice / 100).toFixed(2)}` : 
                           `$${(product.basePrice / 100).toFixed(2)}`}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={product.overrideLevel === "super_admin" ? "default" : 
                                  product.overrideLevel === "head_office" ? "secondary" : "outline"}
                          className={product.overrideLevel === "super_admin" ? "bg-blue-100 text-blue-800" :
                                    product.overrideLevel === "head_office" ? "bg-green-100 text-green-800" : ""}
                        >
                          {product.overrideLevel?.replace("_", " ").toUpperCase() || "SUPER ADMIN"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-600">
                          {getVisibilityCount(product.id)}/{totalBranches} branches
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProductForVisibility(product)
                              setShowVisibilityDialog(true)
                            }}
                          >
                            <Eye size={14} />
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
          {selectedProducts.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {selectedProducts.length} products selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkVisibilityToggle(selectedProducts, true)}
                  >
                    <Eye size={14} className="mr-2" />
                    Show All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkVisibilityToggle(selectedProducts, false)}
                  >
                    <EyeOff size={14} className="mr-2" />
                    Hide All
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Branch Visibility Tab */}
        <TabsContent value="visibility" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Branch Visibility Matrix</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (filteredProducts.length === 0) {
                    toast({
                      title: "No Products",
                      description: "No products available to manage visibility",
                      variant: "destructive",
                    })
                    return
                  }
                  setSelectedProducts(filteredProducts.map(p => p.id))
                }}
              >
                Select All Products
              </Button>
            </div>
          </div>

          {branches && branches.length > 0 ? (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <th className="text-left p-4 font-medium">Product</th>
                    {branches.map(branch => (
                      <th key={branch.id} className="text-center p-4 font-medium">
                        {branch.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-medium">{product.productName}</div>
                        <div className="text-xs text-gray-500">{product.productCode}</div>
                      </td>
                      {branches.map(branch => (
                        <td key={branch.id} className="p-4 text-center">
                          <Switch
                            checked={getBranchVisibility(product.id, branch.id)}
                            onCheckedChange={(checked) => 
                              handleToggleVisibility(product.id, branch.id, checked)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Branches Found</h3>
              <p className="text-muted-foreground">
                No branches are available for this organization. Contact your administrator to set up branches.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Branch Visibility Dialog */}
      <Dialog open={showVisibilityDialog} onOpenChange={setShowVisibilityDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Branch Visibility</DialogTitle>
            <DialogDescription>
              Control which branches can see {selectedProductForVisibility?.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedProductForVisibility && branches && (
              <div className="space-y-3">
                {branches.map(branch => (
                  <div key={branch.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{branch.name}</div>
                      <div className="text-sm text-gray-500">{branch.address || "No address"}</div>
                    </div>
                    <Switch
                      checked={getBranchVisibility(selectedProductForVisibility.id, branch.id)}
                      onCheckedChange={(checked) => 
                        handleToggleVisibility(selectedProductForVisibility.id, branch.id, checked)
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVisibilityDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}