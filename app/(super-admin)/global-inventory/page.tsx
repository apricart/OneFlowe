"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectLabel, SelectGroup } from "@/components/ui/select"
import { Table } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
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
  Upload,
  Globe,
  Download,
  Sparkles,
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"
import { CascadeImpactPreview } from "@/components/inventory/cascade-impact-preview"
import { StockStatusBadge } from "@/components/inventory/stock-status-badge"
import { useAppContext } from "@/components/context/app-context"
import { formatPKR } from "@/lib/utils"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
    if (error instanceof Error && error.name === 'AbortError') {
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
  stockQuantity?: number
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

interface Category {
  id: number
  name: string
}

function SummaryTile({
  label,
  value,
  helper,
  accent,
}: {
  label: string
  value: string | number
  helper: string
  accent: string
}) {
  return (
    <Card className="relative border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900 hover:shadow-md transition-shadow overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${accent}`} />
      <CardContent className="p-5 space-y-2 relative">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r ${accent}`}>
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

export default function GlobalInventoryPage() {
  const { toast } = useToast()
  const { organizationId } = useAppContext()
  const [searchQuery, setSearchQuery] = useState("")
  const [showCsvConfirm, setShowCsvConfirm] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false)
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
  const [perProductOverrides, setPerProductOverrides] = useState<Record<number, { customPrice: string }>>({})
  const [showCsvDialog, setShowCsvDialog] = useState(false)
  const [csvOrganizationId, setCsvOrganizationId] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isUploadingCsv, setIsUploadingCsv] = useState(false)
  const [csvResult, setCsvResult] = useState<{ message: string; imported: number; skippedExisting: number } | null>(null)
  const [csvErrors, setCsvErrors] = useState<string[]>([])

  // Product import state
  const [showProductImportDialog, setShowProductImportDialog] = useState(false)
  const [showProductImportConfirm, setShowProductImportConfirm] = useState(false)
  const [productImportFile, setProductImportFile] = useState<File | null>(null)
  const [isUploadingProducts, setIsUploadingProducts] = useState(false)
  const [productImportResult, setProductImportResult] = useState<{ message: string; imported: number; failed: number } | null>(null)
  const [productImportErrors, setProductImportErrors] = useState<string[]>([])

  useEffect(() => {
    setPerProductOverrides((prev) => {
      const next: Record<number, { customPrice: string }> = {}
      assignmentData.productIds.forEach((productId) => {
        if (prev[productId]) {
          next[productId] = prev[productId]
        }
      })
      return next
    })
  }, [assignmentData.productIds])

  useEffect(() => {
    if (organizationId && assignmentData.organizationId !== String(organizationId)) {
      setAssignmentData((prev) => ({ ...prev, organizationId: String(organizationId) }))
    }
  }, [organizationId, assignmentData.organizationId])

  useEffect(() => {
    if (assignmentData.organizationId && csvOrganizationId !== assignmentData.organizationId) {
      setCsvOrganizationId(assignmentData.organizationId)
    }
  }, [assignmentData.organizationId, csvOrganizationId])

  // Sync assignment data with global context
  useEffect(() => {
    if (organizationId) {
      const orgIdStr = String(organizationId)
      setAssignmentData((prev) => ({ ...prev, organizationId: orgIdStr }))
      setCsvOrganizationId(orgIdStr)
    }
  }, [organizationId])

  // Product form data
  const router = useRouter()

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

  // Fetch categories (parent categories)
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useSWR<{ items: Category[] }>(
    `/api/v1/categories?type=parent`,
    fetcher,
    { fallbackData: { items: [] }, revalidateOnFocus: false }
  )
  const categories = categoriesData?.items || []

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
    let filtered = products.items

    // Apply stock filter
    if (stockFilter === "in-stock") {
      filtered = filtered.filter(p => (p.stockQuantity || 0) > 10)
    } else if (stockFilter === "low-stock") {
      filtered = filtered.filter(p => {
        const stock = p.stockQuantity || 0
        return stock > 0 && stock <= 10
      })
    } else if (stockFilter === "out-of-stock") {
      filtered = filtered.filter(p => (p.stockQuantity || 0) === 0)
    }

    return filtered
  }, [products?.items, stockFilter])

  // Calculate summary stats
  const totalProducts = products?.pagination?.total || 0
  const totalOrganizations = organizations?.length || 0
  const totalAssignments = assignments?.total || 0
  const activeAssignments = useMemo(() => {
    if (!assignments?.items) return 0
    return assignments.items.filter(a => a.isActive).length
  }, [assignments?.items])

  const selectedOrgAssignments = useMemo(() => {
    if (!assignments?.items || !assignmentData.organizationId) return []
    const orgId = parseInt(assignmentData.organizationId)
    if (!Number.isFinite(orgId)) return []
    return assignments.items.filter((assignment) => assignment.organizationId === orgId)
  }, [assignments?.items, assignmentData.organizationId])

  const selectedOrg = useMemo(() => {
    if (!assignmentData.organizationId) return null
    return organizations.find((org) => String(org.id) === assignmentData.organizationId) || null
  }, [assignmentData.organizationId, organizations])

  const selectedOrgActiveAssignments = useMemo(() => {
    return selectedOrgAssignments.filter((assignment) => assignment.isActive).length
  }, [selectedOrgAssignments])

  const selectedOrgCustomPriceCount = useMemo(() => {
    return selectedOrgAssignments.filter((assignment) => assignment.customPrice).length
  }, [selectedOrgAssignments])

  const visibleAssignments = useMemo(() => {
    if (assignmentData.organizationId) {
      return selectedOrgAssignments
    }
    return assignments?.items || []
  }, [assignmentData.organizationId, assignments?.items, selectedOrgAssignments])

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
    router.push("/global-inventory/new")
  }

  const handleEditProductNavigation = (productId: number) => {
    router.push(`/global-inventory/${productId}/edit`)
  }

  const handleDeleteProduct = async (productId: number) => {
    const product = products?.items?.find((p: GlobalProduct) => p.id === productId)
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

  const handleRemoveAssignment = async (assignmentId: number) => {
    try {
      const response = await fetch(`/api/v1/admin/organization-assignments?id=${assignmentId}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to remove assignment")
      }
      toast({
        title: "Assignment removed",
        description: result.message || "Product removed from organization catalog.",
      })
      mutateAssignments()
      mutateProducts()
    } catch (error: any) {
      toast({
        title: "Removal failed",
        description: error.message || "Could not remove assignment",
        variant: "destructive",
      })
    }
  }

  const handleAssignment = (product: GlobalProduct) => {
    if (!organizationId) {
      toast({
        title: "No organization selected",
        description: "Choose a target organization in the workspace first.",
        variant: "destructive",
      })
      return
    }

    // Redirect to dedicated assignment page with context
    const params = new URLSearchParams({
      organizationId: organizationId.toString(),
      productIds: product.id.toString(),
    })
    router.push(`/organization-assignments?${params.toString()}`)
  }

  const handleEditAssignment = (assignment: OrganizationAssignment) => {
    // Redirect to dedicated Organization Assignments page for editing overrides
    router.push(
      `/organization-assignments?organizationId=${assignment.organizationId}&productId=${assignment.globalProductId}`
    )
  }

  const handleBulkAssignment = () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "No products selected",
        description: "Please select products to assign.",
        variant: "destructive",
      })
      return
    }

    if (!organizationId) {
      toast({
        title: "No organization selected",
        description: "Choose a target organization in the workspace first.",
        variant: "destructive",
      })
      return
    }

    // Navigate to dedicated assignment page with context
    const params = new URLSearchParams({
      organizationId: organizationId.toString(),
      productIds: selectedProducts.join(","),
    })
    router.push(`/organization-assignments?${params.toString()}`)
  }

  const handleCsvUpload = async () => {
    if (!csvFile || !csvOrganizationId) {
      toast({
        title: "Missing information",
        description: "Select an organization and upload a CSV file.",
        variant: "destructive",
      })
      return
    }
    setIsUploadingCsv(true)
    setCsvErrors([])
    setCsvResult(null)
    try {
      const formData = new FormData()
      formData.append("file", csvFile)
      formData.append("organizationId", csvOrganizationId)
      const response = await fetch("/api/v1/admin/organization-assignments/import", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) {
        throw result
      }
      setCsvResult({
        message: result.message,
        imported: result.imported,
        skippedExisting: result.skippedExisting,
      })
      setCsvErrors(result.parsingErrors || [])
      toast({
        title: "CSV imported",
        description: result.message,
      })
      mutateAssignments()
      mutateProducts()
    } catch (error: any) {
      setCsvErrors(error?.parsingErrors || [error?.error || "Failed to import CSV"])
      toast({
        title: "Import failed",
        description: error?.error || "Could not process CSV file",
        variant: "destructive",
      })
    } finally {
      setIsUploadingCsv(false)
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent = `productCode,customPrice,customName,customDescription,isActive
PRD-001,1200,Custom Label,Optional description,true`
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "organization-assignment-template.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownloadProductTemplate = () => {
    const csvContent = `productCode,name,description,category,basePrice,unit,status,imageUrl,stockQuantity
PRD-001,Product Name,Product description,Category Name,100.00,unit,active,https://example.com/image.jpg,100`
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "global-products-template.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleProductImport = async () => {
    if (!productImportFile) {
      toast({
        title: "Missing file",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      })
      return
    }
    setIsUploadingProducts(true)
    setProductImportErrors([])
    setProductImportResult(null)
    try {
      const formData = new FormData()
      formData.append("file", productImportFile)
      const response = await fetch("/api/v1/admin/global-inventory/import", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) {
        throw result
      }
      setProductImportResult({
        message: result.message,
        imported: result.imported,
        failed: result.failed || 0,
      })
      if (result.parsingErrors && result.parsingErrors.length > 0) {
        setProductImportErrors(result.parsingErrors)
      }
      if (result.validationErrors && result.validationErrors.length > 0) {
        const validationErrorMessages = result.validationErrors.map(
          (err: any) => `Row ${err.row}: ${err.errors.join(", ")}`
        )
        setProductImportErrors((prev) => [...prev, ...validationErrorMessages])
      }
      toast({
        title: "Products imported",
        description: result.message,
      })
      mutateProducts()
    } catch (error: any) {
      const errorMessages = error?.parsingErrors || error?.validationErrors?.map((err: any) => `Row ${err.row}: ${err.errors.join(", ")}`) || [error?.error || "Failed to import products"]
      setProductImportErrors(errorMessages)
      toast({
        title: "Import failed",
        description: error?.error || "Could not process CSV file",
        variant: "destructive",
      })
    } finally {
      setIsUploadingProducts(false)
    }
  }

  const handlePerProductPriceChange = (productId: number, value: string) => {
    setPerProductOverrides((prev) => ({
      ...prev,
      [productId]: { customPrice: value },
    }))
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
      const assignmentsPayload = assignmentData.productIds.map((productId) => {
        const override = perProductOverrides[productId]
        const priceInput =
          override && override.customPrice !== undefined && override.customPrice !== ""
            ? parseFloat(override.customPrice)
            : assignmentData.customPrice
              ? parseFloat(assignmentData.customPrice)
              : null
        return {
          productId,
          customPrice: priceInput,
          customName: assignmentData.customName || null,
          customDescription: assignmentData.customDescription || null,
          customImageUrl: assignmentData.customImageUrl || null,
          isActive: assignmentData.isActive,
        }
      })
      const requestBody = {
        organizationId: assignmentData.organizationId,
        isActive: assignmentData.isActive,
        assignments: assignmentsPayload,
        customName: assignmentData.customName || null,
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
          customImageUrl: "",
        })
        setPerProductOverrides({})
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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-8">
      <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-800 text-white shadow-xl">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
        </div>
        <CardHeader className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
              <Sparkles className="h-4 w-4" />
              Global Catalog
            </p>
            <CardTitle className="text-3xl font-semibold text-white">Inventory assignment control</CardTitle>
            <p className="text-sm text-white/80">
              Approve products once, assign them everywhere. Select an organization context below to stage custom prices,
              bulk uploads, and CSV-based distributions.
            </p>
          </div>
          <div className="rounded-full bg-white/15 px-4 py-2 text-xs uppercase tracking-wide text-white">
            {totalProducts} products • {totalAssignments} assignments
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Global products" value={totalProducts} helper="In master catalog" accent="from-indigo-500 to-sky-500" />
        <SummaryTile label="Organizations" value={totalOrganizations} helper="Ready for assignment" accent="from-emerald-500 to-lime-500" />
        <SummaryTile label="Assignments" value={totalAssignments} helper="Across all orgs" accent="from-blue-500 to-cyan-500" />
        <SummaryTile label="Active assignments" value={activeAssignments} helper="Currently live" accent="from-rose-500 to-orange-500" />
      </div>

      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-xl dark:text-white">Assignment workspace</CardTitle>
          <p className="text-sm text-muted-foreground dark:text-slate-300">
            Use the context selector in the top bar to focus on an organization, then bulk assign via quick actions or CSV upload.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {selectedOrg ? (
                <>
                  <Badge variant="secondary">Context: {selectedOrg.name}</Badge>
                  <Badge variant="outline">
                    Assigned {selectedOrgAssignments.length} • Active {selectedOrgActiveAssignments}
                  </Badge>
                  <Badge variant="outline">Custom pricing {selectedOrgCustomPriceCount}</Badge>
                </>
              ) : (
                <Badge variant="secondary">Select an organization in the top bar to manage assignments</Badge>
              )}
              {selectedProducts.length > 0 && (
                <Badge variant="outline" className="border-dashed">
                  {selectedProducts.length} product{selectedProducts.length === 1 ? "" : "s"} selected
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleBulkAssignment}
                disabled={!assignmentData.organizationId || selectedProducts.length === 0}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Assign selected
              </Button>
              <Button variant="outline" onClick={() => setShowCsvConfirm(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
              <Button variant="ghost" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSV Upload Confirmation */}
      <ConfirmDialog
        open={showCsvConfirm}
        onOpenChange={setShowCsvConfirm}
        title="Upload CSV for bulk assignment?"
        description={
          selectedOrg
            ? `This will assign products from the CSV file to ${selectedOrg.name}. Make sure your CSV file is formatted correctly before proceeding.`
            : "Please select an organization in the top bar context selector first."
        }
        confirmText="Continue to Upload"
        cancelText="Cancel"
        onConfirm={() => {
          if (organizationId) {
            setShowCsvConfirm(false)
            setShowCsvDialog(true)
          } else {
            toast({
              title: "Organization required",
              description: "Please select an organization in the top bar context selector first.",
              variant: "destructive",
            })
            setShowCsvConfirm(false)
          }
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Global catalog</TabsTrigger>
          <TabsTrigger value="assignments">Organization inventory</TabsTrigger>
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
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Stock</option>
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowProductImportConfirm(true)}>
                <Upload size={16} className="mr-2" />
                Import CSV
              </Button>
              <Button variant="ghost" onClick={handleDownloadProductTemplate}>
                <Download size={16} className="mr-2" />
                Template
              </Button>
              <Button onClick={handleAddProduct}>
                <Plus size={16} className="mr-2" />
                Add Product
              </Button>
            </div>
          </div>

          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
            <Table>
              <thead>
                <tr className="dark:border-slate-700">
                  <th className="text-left p-4 font-medium w-12 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={selectAllProducts}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Code</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Name</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Image</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Category</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Price</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Unit</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Stock</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Status</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Assignments</th>
                  <th className="text-right p-4 font-medium dark:text-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {productsLoading ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-gray-500 dark:text-slate-400">
                      Loading products...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-gray-500 dark:text-slate-400">
                      No products found
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/50 dark:border-slate-700">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-sm dark:text-white">{product.productCode}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium dark:text-white">{product.name}</div>
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
                            className="w-12 h-12 object-cover rounded-lg border dark:border-slate-600"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg border dark:border-slate-600 flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400 dark:text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">
                          {product.categoryName || "No Category"}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm dark:text-white">{formatPKR(product.basePrice / 100)}</td>
                      <td className="p-4 text-sm dark:text-white">{product.unit}</td>
                      <td className="p-4">
                        <StockStatusBadge
                          quantity={product.stockQuantity || 0}
                          threshold={10}
                        />
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={product.status === "active" ? "default" : "secondary"}
                          className={product.status === "active" ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300" : ""}
                        >
                          {product.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-600 dark:text-slate-300">
                          {product.assignedOrganizations} orgs
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProductNavigation(product.id)}
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
            <div>
              <h3 className="text-lg font-semibold">Organization inventory</h3>
              <p className="text-sm text-muted-foreground">
                {selectedOrg
                  ? `Showing catalog for ${selectedOrg.name}`
                  : "Select an organization in the workspace to filter assignments."}
              </p>
            </div>
          </div>

          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
            <Table>
              <thead>
                <tr className="dark:border-slate-700">
                  <th className="text-left p-4 font-medium dark:text-slate-200">Product</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Organization</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Status</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Custom Name</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Custom Price</th>
                  <th className="text-left p-4 font-medium dark:text-slate-200">Assigned</th>
                  <th className="text-right p-4 font-medium dark:text-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignmentsLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-slate-400">
                      Loading assignments...
                    </td>
                  </tr>
                ) : visibleAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-slate-400">
                      {assignmentData.organizationId
                        ? "No products assigned to this organization yet."
                        : "No assignments found."}
                    </td>
                  </tr>
                ) : (
                  visibleAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/50 dark:border-slate-700">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {assignment.productImageUrl ? (
                            <img
                              src={assignment.productImageUrl}
                              alt={assignment.productName}
                              className="w-12 h-12 object-cover rounded-lg border"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg border dark:border-slate-600 flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400 dark:text-slate-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium dark:text-white">{assignment.productName}</div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">{assignment.productCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium dark:text-white">{assignment.organizationName}</div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={assignment.isActive ? "default" : "secondary"}
                          className={assignment.isActive ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300" : ""}
                        >
                          {assignment.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm dark:text-white">{assignment.customName || "-"}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm dark:text-white">
                          {assignment.customPrice ? formatPKR(assignment.customPrice / 100) : "-"}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-600 dark:text-slate-300">
                          {new Date(assignment.assignedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleEditAssignment(assignment)}>
                            <Edit size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveAssignment(assignment.id)}>
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

      {/* Product Import Confirmation */}
      <ConfirmDialog
        open={showProductImportConfirm}
        onOpenChange={setShowProductImportConfirm}
        title="Import products from CSV?"
        description="This will create or update products in the global catalog. Existing products with the same product code will be updated. Make sure your CSV file is formatted correctly."
        confirmText="Continue to Upload"
        cancelText="Cancel"
        onConfirm={() => {
          setShowProductImportConfirm(false)
          setShowProductImportDialog(true)
        }}
      />

      {/* Product Import Dialog */}
      <Dialog
        open={showProductImportDialog}
        onOpenChange={(open) => {
          setShowProductImportDialog(open)
          if (!open) {
            setProductImportFile(null)
            setProductImportResult(null)
            setProductImportErrors([])
          }
        }}
      >
        <DialogContent className="max-w-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import products from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk create or update products in the global catalog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">CSV File</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(event) => setProductImportFile(event.target.files?.[0] || null)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={handleDownloadProductTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download template
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Required columns: <code>productCode</code>, <code>name</code>, <code>basePrice</code>. Optional: <code>description</code>, <code>category</code>, <code>unit</code>, <code>status</code>, <code>imageUrl</code>.
              </p>
            </div>
            {productImportResult && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">{productImportResult.message}</p>
                <p className="text-xs text-muted-foreground">
                  Imported {productImportResult.imported} product(s){productImportResult.failed > 0 ? `, ${productImportResult.failed} failed` : ""}.
                </p>
              </div>
            )}
            {productImportErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive max-h-60 overflow-y-auto">
                <p className="font-semibold">Import errors</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {productImportErrors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleProductImport} disabled={!productImportFile || isUploadingProducts}>
              {isUploadingProducts ? "Importing..." : "Import Products"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog
        open={showCsvDialog}
        onOpenChange={(open) => {
          setShowCsvDialog(open)
          if (!open) {
            setCsvFile(null)
            setCsvResult(null)
            setCsvErrors([])
            setCsvOrganizationId("")
          }
        }}
      >
        <DialogContent className="max-w-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk assign via CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file containing product codes and optional custom pricing to assign products instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Organization</label>
              <select
                value={csvOrganizationId}
                onChange={(e) => setCsvOrganizationId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">CSV File</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download template
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Required column: <code>productCode</code>. Optional: <code>customPrice</code>, <code>customName</code>,
                <code>customDescription</code>, <code>isActive</code>.
              </p>
            </div>
            {csvResult && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">{csvResult.message}</p>
                <p className="text-xs text-muted-foreground">
                  Imported {csvResult.imported} product(s), skipped {csvResult.skippedExisting} already assigned.
                </p>
              </div>
            )}
            {csvErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-semibold">Import warnings</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {csvErrors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCsvDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCsvUpload} disabled={!csvFile || !csvOrganizationId || isUploadingCsv}>
              {isUploadingCsv ? "Importing..." : "Upload CSV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog
        open={showAssignmentDialog}
        onOpenChange={(open) => {
          setShowAssignmentDialog(open)
          if (!open) {
            setPerProductOverrides({})
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
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
                                  className={`flex items-center space-x-3 p-2 rounded border cursor-pointer transition-all ${isSelected
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
                                    onChange={() => { }}
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
                                      {product.productCode} • {formatPKR(product.basePrice / 100)}
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
                            <div key={productId} className="space-y-2 rounded border bg-white p-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{product.name}</div>
                                  <div className="text-xs text-gray-500">{product.productCode}</div>
                                </div>
                                {isAssigned && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Close dialog and navigate to organization assignments page
                                      setShowAssignmentDialog(false)
                                      router.push(
                                        `/organization-assignments?organizationId=${assignmentData.organizationId}&productId=${productId}`
                                      )
                                    }}
                                    className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full hover:bg-yellow-200"
                                  >
                                    Already assigned · Manage overrides
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={perProductOverrides[productId]?.customPrice ?? ""}
                                  onChange={(e) => handlePerProductPriceChange(productId, e.target.value)}
                                  placeholder={isAssigned ? "Overrides managed per organization" : "Custom price (PKR)"}
                                  className="text-sm"
                                  disabled={isAssigned}
                                />
                                <span className="text-xs text-gray-500">
                                  Default {formatPKR(product.basePrice / 100)}
                                </span>
                              </div>
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
    </main>
  )
}
