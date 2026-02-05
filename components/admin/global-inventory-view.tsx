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
import { Search, Package, Sparkles, Plus, Edit, Trash2, Building2 } from "lucide-react"
import { ProductForm } from "@/components/global-inventory/product-form"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

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
    const [statusFilter, setStatusFilter] = useState("all")
    const [categoryFilter, setCategoryFilter] = useState("")
    const [dialogMode, setDialogMode] = useState<"create" | "edit" | "delete" | null>(null)
    const [selectedProduct, setSelectedProduct] = useState<GlobalInventoryItem | null>(null)

    const params = new URLSearchParams()
    if (searchQuery) params.set("search", searchQuery)
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)
    if (categoryFilter) params.set("category", categoryFilter)

    const { data, isLoading, mutate } = useSWR<{
        items: GlobalInventoryItem[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`/api/v1/admin/global-inventory?${params.toString()}`, fetcher, {
        fallbackData: { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } },
        revalidateOnFocus: false,
    })

    const { data: categoriesData } = useSWR<{ items: Array<{ id: number; name: string }> }>(
        "/api/v1/categories?limit=100",
        fetcher,
        { fallbackData: { items: [] } }
    )

    const products = data?.items ?? []
    const totalProducts = data?.pagination.total ?? 0
    const activeProducts = useMemo(() => products.filter((p) => p.status === "active").length, [products])
    const totalAssignments = useMemo(() => products.reduce((sum, p) => sum + p.assignedOrganizations, 0), [products])

    const handleDelete = async () => {
        if (!selectedProduct) return

        try {
            const res = await fetch(`/api/v1/admin/global-inventory?id=${selectedProduct.id}`, {
                method: "DELETE",
            })

            if (res.ok) {
                mutate()
                setDialogMode(null)
                setSelectedProduct(null)
            } else {
                const data = await res.json()
                alert(data.error || "Failed to delete product")
            }
        } catch (error) {
            alert("Failed to delete product")
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
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="">All categories</option>
                            {categoriesData?.items.map((cat) => (
                                <option key={cat.id} value={cat.id.toString()}>
                                    {cat.name}
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
                                ) : products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                                            No products found. Create your first global product to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product) => (
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
                                                            : product.status === "discontinued"
                                                                ? "destructive"
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
                        <DialogTitle className="text-destructive">Delete Product</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete <strong>{selectedProduct?.name}</strong>? This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDialogMode(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
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
