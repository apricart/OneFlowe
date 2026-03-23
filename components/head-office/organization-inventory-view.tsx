"use client"
import { useMemo, useState, useEffect, type ReactNode } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useAppContext } from "@/components/context/app-context"
import { formatPKR } from "@/lib/utils"
import { Search, Package, Building2, ShieldCheck, Sparkles } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type OrganizationInventoryItem = {
    id: number
    isActive: boolean
    productName: string
    productCode: string
    productImageUrl?: string
    customName?: string
    customPrice?: number
    customDescription?: string
    customImageUrl?: string

    categoryName?: string
    parentCategoryName?: string
    basePrice?: number
    unit: string
    assignedAt: string
}
export default function HeadOfficeInventoryView() {
    const { organizationId } = useAppContext()
    const [searchQuery, setSearchQuery] = useState("")
    const debouncedSearch = useDebounce(searchQuery, 300)
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [subCategoryFilter, setSubCategoryFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 20

    // Fetch ALL org inventory data once — no filter params in URL
    const query = `/api/v1/head-office/organization-inventory?limit=5000${organizationId ? `&organizationId=${organizationId}` : ""}`

    const { data, isLoading } = useSWR<{ items: OrganizationInventoryItem[]; total: number }>(query, fetcher, {
        fallbackData: { items: [], total: 0 },
        revalidateOnFocus: false,
        dedupingInterval: 30000,
    })

    const allProducts = data?.items ?? []
    const totalAssigned = allProducts.length

    // Fetch categories and subcategories for filter dropdowns
    const { data: catData } = useSWR<{ items: { id: number, name: string }[] }>('/api/v1/categories?limit=100', fetcher, {
        fallbackData: { items: [] }, revalidateOnFocus: false, dedupingInterval: 60000
    })
    const { data: subCatData } = useSWR<{ items: { id: number, name: string }[] }>(
        categoryFilter !== 'all'
            ? `/api/v1/subcategories?categoryId=${categoryFilter}&limit=100`
            : '/api/v1/subcategories?limit=100',
        fetcher,
        { fallbackData: { items: [] }, revalidateOnFocus: false, dedupingInterval: 60000 }
    )

    // Client-side filtering — instant, no API calls
    const filteredProducts = useMemo(() => {
        let filtered = allProducts

        // Status filter
        if (statusFilter === "active") {
            filtered = filtered.filter((item) => item.isActive)
        } else if (statusFilter === "inactive") {
            filtered = filtered.filter((item) => !item.isActive)
        }

        // Category filter (parent category)
        if (categoryFilter !== 'all') {
            const subCatIds = (subCatData?.items ?? []).map(sc => sc.id)
            if (subCatIds.length > 0) {
                filtered = filtered.filter((item) => {
                    const catName = item.parentCategoryName
                    const matchingCat = catData?.items?.find(c => c.id.toString() === categoryFilter)
                    return catName === matchingCat?.name
                })
            }
        }

        // Subcategory filter
        if (subCategoryFilter !== 'all') {
            const matchingSub = subCatData?.items?.find(sc => sc.id.toString() === subCategoryFilter)
            if (matchingSub) {
                filtered = filtered.filter((item) => item.categoryName === matchingSub.name)
            }
        }

        // Debounced search filter
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase()
            filtered = filtered.filter(
                (item) =>
                    item.productName.toLowerCase().includes(q) ||
                    item.productCode.toLowerCase().includes(q) ||
                    (item.customName?.toLowerCase().includes(q))
            )
        }

        return filtered
    }, [allProducts, statusFilter, categoryFilter, subCategoryFilter, debouncedSearch, catData?.items, subCatData?.items])

    const activeCount = useMemo(() => allProducts.filter((item) => item.isActive).length, [allProducts])
    const customPriceCount = useMemo(
        () => allProducts.filter((item) => item.customPrice !== undefined && item.customPrice !== null).length,
        [allProducts]
    )

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))

    // Reset page when filters change
    useEffect(() => {
        setPage(1)
    }, [debouncedSearch, categoryFilter, subCategoryFilter, statusFilter])

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages)
        }
    }, [totalPages, page])

    const paginatedProducts = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE
        return filteredProducts.slice(start, start + PAGE_SIZE)
    }, [filteredProducts, page])

    return (
        <div className="space-y-8 p-6">
            <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-indigo-900 to-indigo-700 text-white shadow-xl">
                <div className="pointer-events-none absolute inset-0 opacity-30">
                    <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
                </div>
                <CardHeader className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-3">
                        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                            <Sparkles className="h-4 w-4" />
                            Assigned Catalog
                        </p>
                        <CardTitle className="text-3xl font-semibold text-white">Organization inventory</CardTitle>
                        <p className="text-sm text-white/80">
                            Products assigned by Super Admin appear here automatically. Head Office can browse inventory but cannot edit or
                            assign—contact Admin for changes.
                        </p>
                    </div>
                    <div className="rounded-full bg-white/15 px-4 py-2 text-xs uppercase tracking-wide text-white">
                        {totalAssigned} assigned products
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    label="Assigned catalog"
                    value={totalAssigned}
                    helper="Products ready for ordering"
                    icon={<Package className="h-5 w-5 text-white" />}
                    accent="from-indigo-500 to-sky-500"
                />
                <SummaryCard
                    label="Active SKUs"
                    value={activeCount}
                    helper="Active items"
                    icon={<ShieldCheck className="h-5 w-5 text-white" />}
                    accent="from-emerald-500 to-lime-500"
                />

                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
                    <CardContent className="p-4 space-y-2 text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground">Read-only</p>
                        <p>Inventory is centrally managed. Reach out to Super Admins for pricing or visibility changes.</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="text-xl">Assigned products</CardTitle>
                        <p className="text-sm text-muted-foreground">Filtered list of SKUs currently available to your organization.</p>
                    </div>
                    <div className="flex flex-col gap-3 w-full lg:flex-row lg:items-center lg:justify-end">
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or code"
                                className="pl-9"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={(e) => { setCategoryFilter(e.target.value); setSubCategoryFilter('all'); }}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full lg:w-[180px]"
                        >
                            <option value="all">All Categories</option>
                            {catData?.items?.map((cat) => (
                                <option key={cat.id} value={cat.id.toString()}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={subCategoryFilter}
                            onChange={(e) => setSubCategoryFilter(e.target.value)}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full lg:w-[180px]"
                        >
                            <option value="all">All Subcategories</option>
                            {subCatData?.items?.map((sub) => (
                                <option key={sub.id} value={sub.id.toString()}>
                                    {sub.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Subcategory</TableHead>
                                    <TableHead>Unit Price</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Assigned on</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                            Loading assigned catalog…
                                        </TableCell>
                                    </TableRow>
                                ) : assignedProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                            No products have been assigned yet. Once Super Admin approves products for your organization, they
                                            will appear here automatically.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedProducts.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/40">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {item.customImageUrl || item.productImageUrl ? (
                                                        <img
                                                            src={item.customImageUrl || item.productImageUrl}
                                                            alt={item.productName}
                                                            className="h-12 w-12 rounded-lg border object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted/40">
                                                            <Package className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium">{item.customName || item.productName}</p>
                                                        <p className="text-xs text-muted-foreground">{item.productCode}</p>
                                                        {item.customDescription && (
                                                            <p className="text-xs text-muted-foreground line-clamp-1">{item.customDescription}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                                    {item.parentCategoryName || "Uncategorized"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{item.categoryName || "Uncategorized"}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {formatPKR((item.customPrice ?? item.basePrice ?? 0) / 100)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={item.isActive ? "default" : "secondary"}>
                                                    {item.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(item.assignedAt).toLocaleDateString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
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
        </div>
    )
}



function SummaryCard({
    label,
    value,
    helper,
    icon,
    accent,
}: {
    label: string
    value: string | number
    helper: string
    icon: ReactNode
    accent: string
}) {
    return (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
            <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r ${accent}`}>{icon}</div>
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
