"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatPKR, cn } from "@/lib/utils"
import { Search, Package, Sparkles, Plus, Edit, Trash2, Building2, AlertTriangle, Loader2, RefreshCw, CheckCircle, XCircle } from "lucide-react"
import { ProductForm } from "@/components/global-inventory/product-form"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"

const fetcher = (url: string) => fetch(url).then((res) => res.json())
const PAGE_SIZE = 50

type GlobalInventoryItem = {
    id: number
    productCode: string
    name: string
    description?: string
    categoryId?: number
    categoryName?: string
    parentCategoryName?: string
    imageUrl?: string
    basePrice: number
    unit: string
    status: string
    stockQuantity: number
    assignedOrganizations: number
    createdAt: string
    updatedAt: string
}

export default function GlobalInventoryView() {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")
    const debouncedSearch = useDebounce(searchQuery, 300)
    const [statusFilter, setStatusFilter] = useState("all")
    const [categoryFilter, setCategoryFilter] = useState("")
    const [subCategoryFilter, setSubCategoryFilter] = useState("")
    const [page, setPage] = useState(1)
    const [dialogMode, setDialogMode] = useState<"create" | "edit" | "delete" | null>(null)
    const [selectedProduct, setSelectedProduct] = useState<GlobalInventoryItem | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const { toast } = useToast()

    // Fetch ALL products once — no filter params in URL
    const { data, isLoading, mutate } = useSWR<{
        items: GlobalInventoryItem[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`/api/v1/admin/global-inventory?limit=5000`, fetcher, {
        fallbackData: { items: [], pagination: { page: 1, limit: 5000, total: 0, totalPages: 0 } },
        revalidateOnFocus: false,
        dedupingInterval: 30000,
    })

    const { data: categoriesData } = useSWR<{ items: Array<{ id: number; name: string }> }>(
        "/api/v1/categories?limit=100",
        fetcher,
        { fallbackData: { items: [] }, revalidateOnFocus: false, dedupingInterval: 60000 }
    )

    const { data: subcategoriesData } = useSWR<{ items: Array<{ id: number; name: string }> }>(
        categoryFilter ? `/api/v1/subcategories?categoryId=${categoryFilter}&limit=100` : null,
        fetcher,
        { fallbackData: { items: [] }, revalidateOnFocus: false, dedupingInterval: 60000 }
    )

    const allProducts = data?.items ?? []

    // Client-side filtering — instant, no API calls
    const filteredProducts = useMemo(() => {
        let filtered = allProducts

        // Status filter
        if (statusFilter && statusFilter !== "all") {
            filtered = filtered.filter((p) => p.status === statusFilter)
        }

        // Category filter (parent category)
        if (categoryFilter) {
            const catId = parseInt(categoryFilter)
            // Find subcategory IDs belonging to this parent
            const subCatIds = (subcategoriesData?.items ?? []).map(sc => sc.id)
            if (subCatIds.length > 0) {
                filtered = filtered.filter((p) => p.categoryId && subCatIds.includes(p.categoryId))
            }
        }

        // Subcategory filter
        if (subCategoryFilter) {
            const subCatId = parseInt(subCategoryFilter)
            filtered = filtered.filter((p) => p.categoryId === subCatId)
        }

        // Debounced search filter
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase()
            filtered = filtered.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.productCode.toLowerCase().includes(q) ||
                    (p.description?.toLowerCase().includes(q))
            )
        }

        return filtered
    }, [allProducts, statusFilter, categoryFilter, subCategoryFilter, debouncedSearch, subcategoriesData?.items])

    // Reset page when filters change
    useMemo(() => { setPage(1) }, [statusFilter, categoryFilter, subCategoryFilter, debouncedSearch])

    // Paginate the filtered results
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
    const paginatedProducts = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE
        return filteredProducts.slice(start, start + PAGE_SIZE)
    }, [filteredProducts, page])

    const totalProducts = allProducts.length
    const activeProducts = useMemo(() => allProducts.filter((p) => p.status === "active").length, [allProducts])
    const totalAssignments = useMemo(() => allProducts.reduce((sum, p) => sum + p.assignedOrganizations, 0), [allProducts])

    const handleDelete = async () => {
        if (!selectedProduct) return

        setIsDeleting(true)
        try {
            const res = await fetch(`/api/v1/admin/global-inventory?id=${selectedProduct.id}&mode=delete`, {
                method: "DELETE",
            })

            if (res.ok) {
                mutate()
                setDialogMode(null)
                setSelectedProduct(null)
                toast({
                    title: "Success",
                    description: `Product "${selectedProduct.name}" deleted successfully.`
                })
            } else {
                const data = await res.json()
                toast({
                    title: "Error",
                    description: data.error || "Failed to process request",
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to process request",
                variant: "destructive"
            })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Compact Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 md:p-5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 flex items-center justify-center border border-blue-50/50 dark:border-blue-800/50 shadow-inner">
                        <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Global Inventory</h1>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Centralized product catalog for the entire platform</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 shadow-sm" onClick={() => mutate()}>
                        <RefreshCw className="h-4 w-4" />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                    <Button size="sm" className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => router.push("/inventory/add")}>
                        <Plus className="h-4 w-4" />
                        <span>Create Product</span>
                    </Button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    label="Total Products"
                    value={totalProducts}
                    icon={<Package className="h-5 w-5" />}
                    variant="blue"
                />
                <StatCard
                    label="Active Products"
                    value={activeProducts}
                    icon={<CheckCircle className="h-5 w-5" />}
                    variant="green"
                />
                <StatCard
                    label="Inactive Products"
                    value={totalProducts - activeProducts}
                    icon={<XCircle className="h-5 w-5" />}
                    variant="red"
                />
            </div>

            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
                <CardHeader>
                    <CardTitle className="text-xl text-slate-900 dark:text-white">Global product catalog</CardTitle>
                    <p className="text-sm text-muted-foreground">Manage all products in the global catalog.</p>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center">
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or code"
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value)
                                setSubCategoryFilter("") // Reset subcategory when parent changes
                            }}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full lg:w-auto"
                        >
                            <option value="">All categories</option>
                            {categoriesData?.items.map((cat) => (
                                <option key={cat.id} value={cat.id.toString()}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={subCategoryFilter}
                            onChange={(e) => setSubCategoryFilter(e.target.value)}
                            disabled={!categoryFilter}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full lg:w-auto disabled:opacity-50"
                        >
                            <option value="">All subcategories</option>
                            {subcategoriesData?.items.map((sub) => (
                                <option key={sub.id} value={sub.id.toString()}>
                                    {sub.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Subcategory</TableHead>
                                    <TableHead>Base price</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                                            Loading global inventory…
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                                            {filteredProducts.length === 0 && allProducts.length > 0
                                                ? "No products match your filters."
                                                : "No products found. Create your first global product to get started."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedProducts.map((product) => (
                                        <TableRow key={product.id} className="hover:bg-muted/40">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {product.imageUrl ? (
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.name}
                                                            className="h-12 w-12 rounded-lg border object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted/40">
                                                            <Package className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-slate-900 dark:text-white">{product.name}</p>
                                                        <p className="text-xs text-muted-foreground">{product.productCode}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{product.parentCategoryName || "Uncategorized"}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{product.categoryName || "Uncategorized"}</Badge>
                                            </TableCell>
                                            <TableCell>{formatPKR(product.basePrice / 100)}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        product.status === "active"
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                >
                                                    {product.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">{product.stockQuantity}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => {
                                                            setSelectedProduct(product)
                                                            setDialogMode("edit")
                                                        }}
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                        onClick={() => {
                                                            setSelectedProduct(product)
                                                            setDialogMode("delete")
                                                        }}
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
                    {/* Client-side pagination */}
                    <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                        <span>
                            Showing{" "}
                            <span className="font-medium text-foreground">
                                {filteredProducts.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                                –
                                {Math.min(filteredProducts.length, page * PAGE_SIZE)}
                            </span>{" "}
                            of <span className="font-medium text-foreground">{filteredProducts.length}</span> products
                        </span>
                        <div className="inline-flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                                Prev
                            </Button>
                            <span className="text-xs">
                                Page <span className="font-medium text-foreground">{page}</span> / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === totalPages || filteredProducts.length === 0}
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>


            {/* Edit Dialog */}
            <Dialog open={dialogMode === "edit"} onOpenChange={(open) => {
                if (!open) {
                    setDialogMode(null)
                    setSelectedProduct(null)
                }
            }}>
                <DialogContent className="max-w-4xl p-0">
                    <div className="max-h-[85vh] overflow-y-auto">
                        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-semibold">
                                    Edit Product
                                </DialogTitle>
                            </DialogHeader>
                        </div>
                        <div className="px-6 py-6">
                            <ProductForm
                                mode="edit"
                                initialProduct={selectedProduct}
                                onCancel={() => {
                                    setDialogMode(null)
                                    setSelectedProduct(null)
                                }}
                                onSuccess={() => {
                                    setDialogMode(null)
                                    setSelectedProduct(null)
                                    mutate() // Refresh the product list
                                }}
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={dialogMode === "delete"} onOpenChange={(open) => {
                if (!open) {
                    setDialogMode(null)
                    setSelectedProduct(null)
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Permanently Delete Product
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl space-y-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Are you sure you want to permanently delete <strong>{selectedProduct?.name}</strong>?
                            </p>
                            <p className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded border border-destructive/20">
                                ⚠️ This action cannot be undone. This will remove the product from the global catalog and all organization inventories.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setDialogMode(null)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="min-w-[120px]"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : "Delete Product"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function StatCard({ label, value, icon, variant }: { 
    label: string; 
    value: string | number; 
    icon: React.ReactNode;
    variant: 'blue' | 'green' | 'red' | 'amber' | 'purple'
}) {
    const variants = {
        blue: "bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border-blue-100/50 text-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800/30 dark:text-blue-400",
        green: "bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border-emerald-100/50 text-emerald-700 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800/30 dark:text-emerald-400",
        red: "bg-gradient-to-br from-rose-50/80 to-red-50/80 border-rose-100/50 text-rose-700 dark:from-rose-900/20 dark:to-red-900/20 dark:border-rose-800/30 dark:text-rose-400",
        amber: "bg-gradient-to-br from-amber-50/80 to-orange-50/80 border-amber-100/50 text-amber-700 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800/30 dark:text-amber-400",
        purple: "bg-gradient-to-br from-purple-50/80 to-fuchsia-50/80 border-purple-100/50 text-purple-700 dark:from-purple-900/20 dark:to-fuchsia-900/20 dark:border-purple-800/30 dark:text-purple-400",
    }

    const iconBadge = {
        blue: "bg-white/80 text-blue-600 shadow-sm border border-blue-100 dark:bg-slate-800 dark:border-blue-800",
        green: "bg-white/80 text-emerald-600 shadow-sm border border-emerald-100 dark:bg-slate-800 dark:border-emerald-800",
        red: "bg-white/80 text-rose-600 shadow-sm border border-rose-100 dark:bg-slate-800 dark:border-rose-800",
        amber: "bg-white/80 text-amber-600 shadow-sm border border-amber-100 dark:bg-slate-800 dark:border-amber-800",
        purple: "bg-white/80 text-purple-600 shadow-sm border border-purple-100 dark:bg-slate-800 dark:border-purple-800",
    }

    return (
        <div className={cn("flex items-center justify-between p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md", variants[variant])}>
            <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">{label}</p>
                <p className="text-2xl font-black tracking-tight">{value}</p>
            </div>
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", iconBadge[variant])}>
                {icon}
            </div>
        </div>
    )
}


