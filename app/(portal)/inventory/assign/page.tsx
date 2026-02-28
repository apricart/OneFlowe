"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPKR } from "@/lib/utils"
import { Search, Package, Sparkles, Check, Edit, Plus, Building2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAppContext } from "@/components/context/app-context"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type Organization = {
    id: number
    name: string
}

type GlobalProduct = {
    id: number
    productCode: string
    name: string
    basePrice: number
    unit: string
    status: string
    categoryName?: string
    parentCategoryName?: string
    imageUrl?: string
}

type AssignedProduct = {
    id: number
    organizationId: number
    globalProductId: number
    customPrice: number | null
    customName: string | null
    isActive: boolean
    assignedAt: string
    productName: string
    productCode: string
    productImageUrl: string | null
    organizationName: string
    categoryName?: string
    parentCategoryName?: string
}

export default function AssignProductPage() {
    const { toast } = useToast()
    const { organizationId: contextOrgId } = useAppContext()
    const [localOrgId, setLocalOrgId] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")
    const [priceDialogOpen, setPriceDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<GlobalProduct | null>(null)
    const [selectedAssignment, setSelectedAssignment] = useState<AssignedProduct | null>(null)
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [subCategoryFilter, setSubCategoryFilter] = useState("all")
    const [price, setPrice] = useState("")
    const [isActive, setIsActive] = useState(true)
    const [saving, setSaving] = useState(false)

    // Use context org if available, otherwise use local selection
    const selectedOrgId = contextOrgId || localOrgId
    const showOrgSelector = !contextOrgId

    // Fetch organizations (only needed when no context org)
    const { data: orgsData } = useSWR<{ items: Organization[] }>(
        showOrgSelector ? "/api/v1/organizations" : null,
        fetcher,
        { fallbackData: { items: [] } }
    )

    // Fetch all global products with filters
    const productParams = new URLSearchParams()
    productParams.set("limit", "500")
    if (categoryFilter !== "all") productParams.set("category", categoryFilter)
    if (subCategoryFilter !== "all") productParams.set("subCategory", subCategoryFilter)
    if (searchQuery) productParams.set("search", searchQuery)

    const { data: productsData, isLoading: productsLoading } = useSWR<{
        items: GlobalProduct[]
    }>(
        `/api/v1/admin/global-inventory?${productParams.toString()}`,
        fetcher,
        { fallbackData: { items: [] } }
    )

    // Fetch assigned products for selected organization
    const { data: assignmentsData, isLoading: assignmentsLoading, mutate: mutateAssignments } = useSWR<{
        items: AssignedProduct[]
    }>(
        selectedOrgId ? `/api/v1/admin/organization-assignments?organizationId=${selectedOrgId}` : null,
        fetcher,
        { fallbackData: { items: [] } }
    )

    const allProducts = productsData?.items ?? []
    const assignedProducts = assignmentsData?.items ?? []
    const assignedProductIds = new Set(assignedProducts.map(a => a.globalProductId))

    // Filter products: Not assigned = products not in assignedProductIds
    const notAssignedProducts = useMemo(() => {
        return allProducts.filter(p => !assignedProductIds.has(p.id))
    }, [allProducts, assignedProductIds])

    const filteredNotAssigned = notAssignedProducts
    const filteredAssigned = assignedProducts

    const handleAssignClick = (product: GlobalProduct) => {
        setSelectedProduct(product)
        setPrice("")
        setIsActive(true)
        setPriceDialogOpen(true)
    }

    const handleEditClick = (assignment: AssignedProduct) => {
        setSelectedAssignment(assignment)
        setPrice(assignment.customPrice ? (assignment.customPrice / 100).toString() : "")
        setIsActive(assignment.isActive)
        setEditDialogOpen(true)
    }

    const handleAssignProduct = async () => {
        if (!selectedProduct || !selectedOrgId || !price) {
            toast({ title: "Error", description: "Please enter a price", variant: "destructive" })
            return
        }

        setSaving(true)
        try {
            const res = await fetch("/api/v1/admin/organization-assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productIds: [selectedProduct.id],
                    organizationId: parseInt(selectedOrgId),
                    customPrice: parseFloat(price),
                    isActive: isActive,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to assign product")
            }

            toast({ title: "Success", description: "Product assigned successfully" })
            setPriceDialogOpen(false)
            setSelectedProduct(null)
            mutateAssignments()
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        } finally {
            setSaving(false)
        }
    }

    const handleUpdatePrice = async () => {
        if (!selectedAssignment || !price) {
            toast({ title: "Error", description: "Please enter a price", variant: "destructive" })
            return
        }

        setSaving(true)
        try {
            const res = await fetch("/api/v1/admin/organization-assignments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedAssignment.id,
                    customPrice: parseFloat(price),
                    isActive: isActive,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to update price")
            }

            toast({ title: "Success", description: "Price updated successfully" })
            setEditDialogOpen(false)
            setSelectedAssignment(null)
            mutateAssignments()
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-8 p-6">
            {/* Organization Selector - Only shown when no org selected in header */}
            {showOrgSelector && (
                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Select Organization</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select value={localOrgId} onValueChange={setLocalOrgId}>
                            <SelectTrigger className="w-full max-w-md">
                                <SelectValue placeholder="Select an organization" />
                            </SelectTrigger>
                            <SelectContent>
                                {orgsData?.items.map((org) => (
                                    <SelectItem key={org.id} value={org.id.toString()}>
                                        {org.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
            )}

            {/* Products Table with Tabs */}
            {selectedOrgId && (
                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="text-xl">Product Assignments</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Manage product assignments for the selected organization.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end w-full">
                            <div className="relative w-full lg:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search products..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <CategoryFilter value={categoryFilter} onChange={(val) => { setCategoryFilter(val); setSubCategoryFilter('all'); }} />
                            <SubcategoryFilter categoryId={categoryFilter} value={subCategoryFilter} onChange={setSubCategoryFilter} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="not-assigned" className="w-full">
                            <TabsList className="grid w-full max-w-md grid-cols-2">
                                <TabsTrigger value="not-assigned">
                                    Not Assigned ({filteredNotAssigned.length})
                                </TabsTrigger>
                                <TabsTrigger value="assigned">
                                    Assigned ({filteredAssigned.length})
                                </TabsTrigger>
                            </TabsList>

                            {/* Not Assigned Tab */}
                            <TabsContent value="not-assigned" className="mt-4">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Subcategory</TableHead>
                                                <TableHead>Base Price</TableHead>
                                                <TableHead>Unit</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {productsLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                                        Loading products...
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredNotAssigned.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                                        {notAssignedProducts.length === 0
                                                            ? "All products are assigned to this organization."
                                                            : "No products match your search."}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredNotAssigned.map((product) => (
                                                    <TableRow key={product.id} className="hover:bg-muted/40">
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                {product.imageUrl ? (
                                                                    <img
                                                                        src={product.imageUrl}
                                                                        alt={product.name}
                                                                        className="h-10 w-10 rounded-lg border object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/40">
                                                                        <Package className="h-4 w-4 text-muted-foreground" />
                                                                    </div>
                                                                )}
                                                                <span className="font-medium">{product.name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                                                {product.parentCategoryName || "Uncategorized"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{product.categoryName || "Uncategorized"}</Badge>
                                                        </TableCell>
                                                        <TableCell>{formatPKR(product.basePrice / 100)}</TableCell>
                                                        <TableCell>{product.unit}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleAssignClick(product)}
                                                                className="gap-1"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                                Assign
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            {/* Assigned Tab */}
                            <TabsContent value="assigned" className="mt-4">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Subcategory</TableHead>
                                                <TableHead>Custom Price</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {assignmentsLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                                        Loading assignments...
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredAssigned.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                                        No products assigned yet.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredAssigned.map((assignment) => (
                                                    <TableRow key={assignment.id} className="hover:bg-muted/40">
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                {assignment.productImageUrl ? (
                                                                    <img
                                                                        src={assignment.productImageUrl}
                                                                        alt={assignment.productName}
                                                                        className="h-10 w-10 rounded-lg border object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/40">
                                                                        <Package className="h-4 w-4 text-muted-foreground" />
                                                                    </div>
                                                                )}
                                                                <span className="font-medium">{assignment.customName || assignment.productName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                                                {assignment.parentCategoryName || "Uncategorized"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{assignment.categoryName || "Uncategorized"}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {assignment.customPrice
                                                                ? formatPKR(assignment.customPrice / 100)
                                                                : <span className="text-muted-foreground">Not set</span>}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={(assignment as any).globalStatus === "active" ? "default" : "secondary"}>
                                                                {(assignment as any).globalStatus === "active" ? "Active" : "Inactive"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEditClick(assignment)}
                                                                className="gap-1"
                                                            >
                                                                <Edit className="h-3 w-3" />
                                                                Edit Price
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}

            {/* Assign Price Dialog */}
            <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Set Product Price</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedProduct && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <Package className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{selectedProduct.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Base price: {formatPKR(selectedProduct.basePrice / 100)}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-2">Custom Price (PKR)</label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="Enter custom price"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                This price will be used for orders from this organization.
                            </p>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">Active Status</label>
                                <p className="text-xs text-muted-foreground">Make product visible to organization</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPriceDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAssignProduct} disabled={saving || !price}>
                            {saving ? "Assigning..." : "Assign Product"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Price Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Product Price</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedAssignment && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <Package className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{selectedAssignment.productName}</p>
                                    <p className="text-xs text-muted-foreground">Code: {selectedAssignment.productCode}</p>
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-2">Custom Price (PKR)</label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="Enter custom price"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">Active Status</label>
                                <p className="text-xs text-muted-foreground">Toggle organization-level visibility</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdatePrice} disabled={saving || !price}>
                            {saving ? "Updating..." : "Update Price"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
const CategoryFilter = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const { data } = useSWR<{ items: { id: number, name: string }[] }>('/api/v1/categories?limit=100', fetcher)
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full lg:w-[180px]"
        >
            <option value="all">All Categories</option>
            {data?.items?.map((cat) => (
                <option key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                </option>
            ))}
        </select>
    )
}

const SubcategoryFilter = ({ categoryId, value, onChange }: { categoryId: string, value: string, onChange: (val: string) => void }) => {
    const query = categoryId !== 'all'
        ? `/api/v1/subcategories?categoryId=${categoryId}&limit=100`
        : '/api/v1/subcategories?limit=100'
    const { data } = useSWR<{ items: { id: number, name: string }[] }>(query, fetcher)

    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full lg:w-[180px]"
        >
            <option value="all">All Subcategories</option>
            {data?.items?.map((cat) => (
                <option key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                </option>
            ))}
        </select>
    )
}
