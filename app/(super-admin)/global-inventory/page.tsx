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
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Building2,
  Share2,
  Check,
  X,
  Eye,
  EyeOff,
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"
import { CascadeImpactPreview } from "@/components/inventory/cascade-impact-preview"
import { useAppContext } from "@/components/context/app-context"

const fetcher = async (url: string) => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

interface GlobalProduct {
  id: number
  productCode: string
  name: string
  description?: string
  categoryId?: number
  imageUrl?: string
  basePrice: number
  unit: string
  status: string
  createdAt: string
  updatedAt: string
  categoryName?: string
  assignedOrganizations: number
}

interface Organization {
  id: number
  name: string
  description?: string
  createdAt: string
}

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

export default function GlobalInventoryPage() {
  const { toast } = useToast()
  const { organizationId } = useAppContext()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<GlobalProduct | null>(null)
  const [activeTab, setActiveTab] = useState("products")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<GlobalProduct | null>(null)
  const [cascadeImpact, setCascadeImpact] = useState<{
    affectedOrgs: number
    affectedBranches: number
  } | null>(null)
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(true)
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const productsPerPage = 10

  // Assignment form data
  const [assignmentData, setAssignmentData] = useState({
    productIds: [] as number[],
    organizationId: "",
    isActive: true,
    customName: "",
    customPrice: "",
    customDescription: "",
    customImageUrl: "",
  })

  // Product form data
  const [productData, setProductData] = useState({
    productCode: "",
    name: "",
    description: "",
    categoryId: "",
    imageUrl: "",
    basePrice: "",
    unit: "unit",
    status: "active",
  })

  // Fetch data
  const { data: products, error: productsError, isLoading: productsLoading, mutate: mutateProducts } = useSWR<{
    items: GlobalProduct[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>(`/api/v1/admin/global-inventory?search=${searchQuery}&status=${statusFilter}`, fetcher)

  const { data: orgsData, error: orgsError, isLoading: orgsLoading, mutate: mutateOrgs } = useSWR<{ items: Organization[] }>("/api/v1/organizations", fetcher, {
    fallbackData: { items: [] },
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 0,
    onError: (error) => {
      console.error("Organizations fetch error:", error)
      // Retry after 2 seconds if it's a timeout error
      if (error.message.includes('timeout') || error.message.includes('Request timeout')) {
        setTimeout(() => {
          console.log("Retrying organizations fetch...")
          mutateOrgs()
        }, 2000)
      }
    }
  })
  
  const organizations = orgsData?.items || []
  
  // Debug logging
  console.log("Organizations data:", orgsData)
  console.log("Organizations error:", orgsError)
  console.log("Organizations loading:", orgsLoading)
  
  // Show error in UI if there's an issue
  if (orgsError) {
    console.error("Failed to fetch organizations:", orgsError)
  }

  const { data: assignments, error: assignmentsError, isLoading: assignmentsLoading, mutate: mutateAssignments } = useSWR<{
    items: OrganizationAssignment[]
    total: number
  }>("/api/v1/admin/organization-assignments", fetcher, {
    fallbackData: { items: [], total: 0 }
  })

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!products?.items) return []
    return products.items
  }, [products?.items])

  // Calculate summary stats
  const totalProducts = products?.pagination?.total || 0
  const totalOrganizations = organizations?.length || 0
  const totalAssignments = assignments?.total || 0
  const activeAssignments = useMemo(() => {
    if (!assignments?.items) return 0
    return assignments.items.filter(a => a.isActive).length
  }, [assignments?.items])

  // Get assigned product IDs for the selected organization
  const getAssignedProductIds = useMemo(() => {
    if (!assignments?.items || !assignmentData.organizationId) return new Set<number>()
    return new Set(
      assignments.items
        .filter(a => a.organizationId === parseInt(assignmentData.organizationId) && a.isActive)
        .map(a => a.globalProductId)
    )
  }, [assignments?.items, assignmentData.organizationId])

  // Filter products based on assignment status and search
  const getFilteredProducts = useMemo(() => {
    if (!products?.items) return []
    
    let filtered = products.items
    
    // Filter by assignment status
    if (showOnlyUnassigned && assignmentData.organizationId) {
      const assignedIds = getAssignedProductIds
      filtered = filtered.filter(product => !assignedIds.has(product.id))
    }
    
    // Filter by search query
    if (productSearchQuery.trim()) {
      const query = productSearchQuery.toLowerCase()
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.productCode.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [products?.items, showOnlyUnassigned, assignmentData.organizationId, getAssignedProductIds, productSearchQuery])

  // Paginated products
  const getPaginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * productsPerPage
    const endIndex = startIndex + productsPerPage
    return getFilteredProducts.slice(startIndex, endIndex)
  }, [getFilteredProducts, currentPage, productsPerPage])

  // Calculate pagination info
  const totalPages = Math.ceil(getFilteredProducts.length / productsPerPage)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  const handleAddProduct = () => {
    setProductData({
      productCode: "",
      name: "",
      description: "",
      categoryId: "",
      imageUrl: "",
      basePrice: "",
      unit: "unit",
      status: "active",
    })
    setEditingProduct(null)
    setShowAddDialog(true)
  }

  const handleEditProduct = (product: GlobalProduct) => {
    setProductData({
      productCode: product.productCode,
      name: product.name,
      description: product.description || "",
      categoryId: product.categoryId?.toString() || "",
      imageUrl: product.imageUrl || "",
      basePrice: (product.basePrice / 100).toFixed(2),
      unit: product.unit,
      status: product.status,
    })
    setEditingProduct(product)
    setShowAddDialog(true)
  }

  const handleSubmitProduct = async () => {
    if (!productData.productCode || !productData.name || !productData.basePrice) {
      toast({
        title: "Validation Error",
        description: "Product code, name, and base price are required",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingProduct 
        ? `/api/v1/admin/global-inventory` 
        : `/api/v1/admin/global-inventory`
      
      const method = editingProduct ? "PUT" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productData,
          id: editingProduct?.id,
          basePrice: parseFloat(productData.basePrice),
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        })
        setShowAddDialog(false)
        mutateProducts()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save product",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving product:", error)
      toast({
        title: "Error",
        description: "Failed to save product",
        variant: "destructive",
      })
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    const product = products?.find(p => p.id === productId)
    if (!product) return

    // Show cascade impact preview
    setDeletingProduct(product)
    setCascadeImpact({
      affectedOrgs: product.assignedOrganizations,
      affectedBranches: product.assignedOrganizations * 3, // Estimate 3 branches per org
    })
    setShowDeleteConfirm(true)
  }

  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return

    try {
      const response = await fetch(`/api/v1/admin/global-inventory?id=${deletingProduct.id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        })
        setShowDeleteConfirm(false)
        setDeletingProduct(null)
        setCascadeImpact(null)
        mutateProducts()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete product",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      })
    }
  }

  const handleAssignment = (product: GlobalProduct) => {
      setAssignmentData({
      productIds: [product.id],
      organizationId: organizationId ? organizationId.toString() : "",
      isActive: true,
      customName: product.name,
      customDescription: product.description || "",
    })
    setShowOnlyUnassigned(true) // Default to showing only unassigned
    setShowAssignmentDialog(true)
  }

  const handleBulkAssignment = () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select products to assign",
        variant: "destructive",
      })
      return
    }
    setAssignmentData({
      productIds: selectedProducts,
      organizationId: organizationId ? organizationId.toString() : "",
      isActive: true,
        customName: "",
      customPrice: "",
        customDescription: "",
      })
    setShowOnlyUnassigned(true) // Default to showing only unassigned
    setProductSearchQuery("") // Reset search
    setCurrentPage(1) // Reset to first page
    setShowAssignmentDialog(true)
  }

  // Pagination handlers
  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const handlePrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const handleSearchChange = (query: string) => {
    setProductSearchQuery(query)
    setCurrentPage(1) // Reset to first page when searching
  }

  // Select all products on current page
  const handleSelectAllPage = () => {
    const unassignedProducts = getPaginatedProducts.filter(product => !getAssignedProductIds.has(product.id))
    const newProductIds = [...new Set([...assignmentData.productIds, ...unassignedProducts.map(p => p.id)])]
    setAssignmentData(prev => ({ ...prev, productIds: newProductIds }))
  }

  // Deselect all products on current page
  const handleDeselectAllPage = () => {
    const currentPageIds = getPaginatedProducts.map(p => p.id)
    const newProductIds = assignmentData.productIds.filter(id => !currentPageIds.includes(id))
    setAssignmentData(prev => ({ ...prev, productIds: newProductIds }))
  }

  // Check if all unassigned products on current page are selected
  const allPageSelected = useMemo(() => {
    const unassignedProducts = getPaginatedProducts.filter(product => !getAssignedProductIds.has(product.id))
    return unassignedProducts.length > 0 && unassignedProducts.every(product => assignmentData.productIds.includes(product.id))
  }, [getPaginatedProducts, getAssignedProductIds, assignmentData.productIds])

  const handleSubmitAssignment = async () => {
    if (!assignmentData.organizationId) {
      toast({
        title: "Organization Required",
        description: "Please select an organization",
        variant: "destructive",
      })
      return
    }

    try {
      const requestBody = {
          productIds: assignmentData.productIds,
          organizationId: assignmentData.organizationId,
          isActive: assignmentData.isActive,
          customName: assignmentData.customName || null,
          customPrice: assignmentData.customPrice ? parseFloat(assignmentData.customPrice) : null,
          customDescription: assignmentData.customDescription || null,
          customImageUrl: assignmentData.customImageUrl || null,
      }
      
      console.log("Sending assignment request:", requestBody)
      
      const response = await fetch("/api/v1/admin/organization-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()
      console.log("Assignment response:", { status: response.status, result })

      if (response.ok) {
        // Handle partial success (some products already assigned)
        if (result.alreadyAssigned && result.alreadyAssigned.length > 0) {
          toast({
            title: "Partial Success",
            description: result.message,
            variant: "default",
          })
        } else {
        toast({
          title: "Success",
          description: result.message,
        })
        }
        setShowAssignmentDialog(false)
        setAssignmentData({
          productIds: [],
          organizationId: "",
          isActive: true,
          customName: "",
          customPrice: "",
          customDescription: "",
        })
      mutateAssignments()
        mutateProducts()
      } else {
        console.error("Assignment failed:", result)
        
        // Handle specific error cases
        if (result.error === "All selected products are already assigned to this organization") {
        toast({
            title: "Products Already Assigned",
            description: "All selected products are already assigned to this organization. Please select different products or choose a different organization.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Assignment Failed",
            description: result.error || "Failed to assign products. Please try again.",
          variant: "destructive",
        })
        }
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
      selectedProducts.length === filteredProducts.length 
        ? [] 
        : filteredProducts.map(p => p.id)
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Global Inventory Management"
        subtitle="Manage global products and assign them to organizations"
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
              <p className="text-sm font-medium text-gray-600">Organizations</p>
              <p className="text-2xl font-bold">{totalOrganizations}</p>
            </div>
            <Building2 className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assignments</p>
              <p className="text-2xl font-bold">{totalAssignments}</p>
            </div>
            <Share2 className="h-8 w-8 text-purple-600" />
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
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Global Products</TabsTrigger>
          <TabsTrigger value="assignments">Organization Assignments</TabsTrigger>
        </TabsList>

        {/* Global Products Tab */}
        <TabsContent value="products" className="space-y-4">
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
                <Button onClick={handleBulkAssignment}>
                  <Share2 size={16} className="mr-2" />
                  Assign Selected ({selectedProducts.length})
                </Button>
              )}
              <Button onClick={handleAddProduct}>
                  <Plus size={16} className="mr-2" />
                  Add Product
                </Button>
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
                  <th className="text-left p-4 font-medium">Code</th>
                  <th className="text-left p-4 font-medium">Name</th>
                  <th className="text-left p-4 font-medium">Image</th>
                  <th className="text-left p-4 font-medium">Category</th>
                  <th className="text-left p-4 font-medium">Price</th>
                  <th className="text-left p-4 font-medium">Unit</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Assignments</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {productsLoading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">
                      No products found
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
                        <div className="font-mono text-sm">{product.productCode}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded-lg border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">
                          {product.categoryName || "No Category"}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">${(product.basePrice / 100).toFixed(2)}</td>
                      <td className="p-4 text-sm">{product.unit}</td>
                      <td className="p-4">
                        <Badge
                          variant={product.status === "active" ? "default" : "secondary"}
                          className={product.status === "active" ? "bg-green-100 text-green-800" : ""}
                        >
                          {product.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-600">
                          {product.assignedOrganizations} orgs
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                          >
                              <Edit size={14} />
                            </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAssignment(product)}
                          >
                            <Share2 size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 size={14} />
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

        {/* Organization Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Organization Assignments</h3>
          </div>

          <Card>
            <Table>
              <thead>
                <tr>
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
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      Loading assignments...
                    </td>
                  </tr>
                ) : assignments?.items?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No assignments found
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
                        <div className="font-medium">{assignment.productName}</div>
                            <div className="text-xs text-gray-500">{assignment.productCode}</div>
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
                        <div className="text-sm">{assignment.customName || "-"}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {assignment.customPrice ? `$${(assignment.customPrice / 100).toFixed(2)}` : "-"}
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
                            onClick={() => {
                              // Handle remove assignment
                            }}
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
        </TabsContent>
      </Tabs>

      {/* Add/Edit Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={() => setShowAddDialog(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Update product information" : "Create a new global product"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium mb-2">Product Code *</label>
                <Input
                  value={productData.productCode}
                  onChange={(e) => setProductData({ ...productData, productCode: e.target.value })}
                  placeholder="PRD-001"
                required
                />
            </div>
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <Input
                  value={productData.name}
                  onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                  placeholder="Product Name"
                  required
                />
                </div>
              </div>

              <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={productData.description}
                onChange={(e) => setProductData({ ...productData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Product description"
                />
              </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Base Price *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={productData.basePrice}
                  onChange={(e) => setProductData({ ...productData, basePrice: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Unit</label>
                <Input
                  value={productData.unit}
                  onChange={(e) => setProductData({ ...productData, unit: e.target.value })}
                  placeholder="unit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium mb-2">Category ID</label>
              <Input
                  value={productData.categoryId}
                  onChange={(e) => setProductData({ ...productData, categoryId: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={productData.status}
                  onChange={(e) => setProductData({ ...productData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Image URL</label>
              <Input
                value={productData.imageUrl}
                onChange={(e) => setProductData({ ...productData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitProduct}>
              {editingProduct ? "Update Product" : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={() => setShowAssignmentDialog(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Package className="w-5 h-5" />
               Assign Products to Organization
             </DialogTitle>
            <DialogDescription>
               Select an organization and configure product assignments with custom overrides.
               {organizationId && (
                 <span className="block mt-1 text-xs text-blue-600">
                   💡 Organization pre-filled from context selector
                 </span>
               )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* Left Column - Organization & Product Selection */}
          <div className="space-y-4">
                {/* Organization Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Target Organization
                      {organizationId && (
                        <span className="ml-2 text-xs text-green-600">(Pre-filled)</span>
                      )}
                    </label>
                    {orgsError && (
                      <button
                        type="button"
                        onClick={() => mutateOrgs()}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Retry
                      </button>
                    )}
                    </div>
              <select
                value={assignmentData.organizationId}
                onChange={(e) => setAssignmentData({ ...assignmentData, organizationId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select organization</option>
                    {orgsLoading ? (
                      <option value="" disabled>Loading organizations...</option>
                    ) : orgsError ? (
                      <option value="" disabled>Error loading organizations - Retrying...</option>
                    ) : organizations && organizations.length > 0 ? (
                      organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                      ))
                    ) : (
                      <option value="" disabled>No organizations found - Create one first</option>
                )}
              </select>
            </div>

                {/* Product Selection */}
                {assignmentData.organizationId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        Available Products ({getFilteredProducts.length})
                      </label>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="showOnlyUnassigned"
                            checked={showOnlyUnassigned}
                            onChange={(e) => setShowOnlyUnassigned(e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor="showOnlyUnassigned" className="text-xs text-gray-600">
                            Unassigned only
                          </label>
                        </div>
                        {getPaginatedProducts.length > 0 && (
                          <button
                            onClick={allPageSelected ? handleDeselectAllPage : handleSelectAllPage}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {allPageSelected ? 'Deselect All' : 'Select All'} (Page)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productSearchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="border rounded-lg bg-gray-50">
                      {/* Product List */}
                      <div className="p-3 max-h-64 overflow-y-auto">
                        {getPaginatedProducts.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">
                              {productSearchQuery.trim() 
                                ? "No products match your search"
                                : showOnlyUnassigned 
                                  ? "All products are already assigned to this organization" 
                                  : "No products available"
                              }
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {getPaginatedProducts.map(product => {
                              const isSelected = assignmentData.productIds.includes(product.id)
                              const isAssigned = getAssignedProductIds.has(product.id)
                              
                              return (
                                <div
                                  key={product.id}
                                  className={`flex items-center space-x-3 p-2 rounded border cursor-pointer transition-all ${
                                    isSelected 
                                      ? 'bg-blue-100 border-blue-300 shadow-sm' 
                                      : 'hover:bg-white hover:shadow-sm'
                                  } ${isAssigned ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  onClick={() => {
                                    if (isAssigned) return
                                    
                                    setAssignmentData(prev => ({
                                      ...prev,
                                      productIds: isSelected 
                                        ? prev.productIds.filter(id => id !== product.id)
                                        : [...prev.productIds, product.id]
                                    }))
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded"
                                    disabled={isAssigned}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm truncate">{product.name}</span>
                                      {isAssigned && (
                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                          Assigned
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {product.productCode} • ${(product.basePrice / 100).toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="border-t bg-white px-3 py-2 flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            Page {currentPage} of {totalPages} ({getFilteredProducts.length} products)
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handlePrevPage}
                              disabled={!hasPrevPage}
                              className="px-2 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                              Previous
                            </button>
                            <button
                              onClick={handleNextPage}
                              disabled={!hasNextPage}
                              className="px-2 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {assignmentData.productIds.length > 0 && (
                      <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded">
                        ✓ {assignmentData.productIds.length} product{assignmentData.productIds.length !== 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column - Selected Products & Customization */}
              <div className="space-y-4">
                {/* Selected Products Summary */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selected Products</label>
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto bg-gray-50">
                    {assignmentData.productIds.length === 0 ? (
                      <div className="text-center text-gray-500 py-4">
                        <Package className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No products selected</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {assignmentData.productIds.map(productId => {
                          const product = products?.items?.find(p => p.id === productId)
                          const isAssigned = assignmentData.organizationId ? getAssignedProductIds.has(productId) : false
                          return product ? (
                            <div key={productId} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{product.name}</div>
                                <div className="text-xs text-gray-500">{product.productCode}</div>
                              </div>
                              {isAssigned && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                  Already Assigned
                                </span>
                              )}
                            </div>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Customization Options */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Custom Overrides (Optional)</h4>
                  
                  <div className="space-y-3">
              <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Custom Name</label>
                <Input
                  value={assignmentData.customName}
                  onChange={(e) => setAssignmentData({ ...assignmentData, customName: e.target.value })}
                  placeholder="Override product name"
                        className="text-sm"
                />
                </div>
                    
              <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Custom Price</label>
                <Input
                  type="number"
                  step="0.01"
                  value={assignmentData.customPrice}
                  onChange={(e) => setAssignmentData({ ...assignmentData, customPrice: e.target.value })}
                  placeholder="Override price"
                        className="text-sm"
                />
            </div>

            <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Custom Description</label>
              <textarea
                value={assignmentData.customDescription}
                onChange={(e) => setAssignmentData({ ...assignmentData, customDescription: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        rows={2}
                placeholder="Override product description"
              />
                    </div>
                  </div>
            </div>

                {/* Assignment Settings */}
                <div className="pt-3 border-t">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={assignmentData.isActive}
                onChange={(e) => setAssignmentData({ ...assignmentData, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Enable this assignment
              </label>
            </div>
          </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitAssignment}
              disabled={!assignmentData.organizationId || assignmentData.productIds.length === 0}
            >
              Assign {assignmentData.productIds.length} Product{assignmentData.productIds.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {deletingProduct && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  {deletingProduct.imageUrl ? (
                    <img
                      src={deletingProduct.imageUrl}
                      alt={deletingProduct.name}
                      className="w-12 h-12 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{deletingProduct.name}</div>
                    <div className="text-xs text-gray-500">{deletingProduct.productCode}</div>
                  </div>
                </div>
              </div>
            )}

            {cascadeImpact && (
              <CascadeImpactPreview
                type="delete"
                affectedOrgs={cascadeImpact.affectedOrgs}
                affectedBranches={cascadeImpact.affectedBranches}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteProduct}>
              Delete Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
