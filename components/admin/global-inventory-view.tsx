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
import { formatPKR } from "@/lib/utils"
import { Search, Package, Sparkles, Plus, Edit, Trash2, Building2, AlertTriangle, Loader2 } from "lucide-react"
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
        <div className="space-y-8 p-6">
            <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-800 text-white shadow-xl">
                <div className="pointer-events-none absolute inset-0 opacity-30">
                    <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
                </div>
                <CardHeader className="relative space-y-3">
                    <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                        <Sparkles className="h-4 w-4" />
                        Super Admin
                    </p>
                    <CardTitle className="text-3xl font-semibold text-white">Global inventory</CardTitle>
                    <p className="text-sm text-white/80">
                        Centralized product catalog. Create and manage products that can be assigned to organizations across the
                        entire platform.
                    </p>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <SummaryCard label="Total products" value={totalProducts} helper="In global catalog" accent="from-blue-500 to-cyan-500" />
                <SummaryCard
                    label="Active products"
                    value={activeProducts}
                    helper={`${totalProducts - activeProducts} inactive`}
                    accent="from-emerald-500 to-lime-500"
                />
            </div>

            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="text-xl text-slate-900 dark:text-white">Global product catalog</CardTitle>
                        <p className="text-sm text-muted-foreground">Manage all products in the global catalog.</p>
                    </div>
                    <Button className="gap-2" onClick={() => router.push("/inventory/add")}>
                        <Plus className="h-4 w-4" />
                        Create product
                    </Button>
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

function SummaryCard({
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
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
            <CardContent className="p-5 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
                <p className="text-xs text-muted-foreground">{helper}</p>
                <div className={`h-1 rounded-full bg-gradient-to-r ${accent}`} />
            </CardContent>
        </Card>
    )
}
