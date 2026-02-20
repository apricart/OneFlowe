"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatPKR } from "@/lib/utils"
import { Search, Package, Eye, Building2, GitBranch } from "lucide-react"
import { useAppContext } from "@/components/context/app-context"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type Organization = { id: number; name: string }
type Group = { id: number; name: string; organizationId: number }

type BranchProduct = {
    id: number
    branchId: number
    branchName: string
    productName: string
    productCode: string
    productImageUrl: string | null
    customName: string | null
    customPrice: number | null
    isVisible: boolean
    isActive: boolean
    assignedAt: string
}

export default function ViewBranchProductsPage() {
    const { organizationId: contextOrgId } = useAppContext()
    const [localOrgId, setLocalOrgId] = useState<string>("")
    const [selectedGroupId, setSelectedGroupId] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")

    const selectedOrgId = contextOrgId || localOrgId
    const showOrgSelector = !contextOrgId

    // Fetch organizations
    const { data: orgsData } = useSWR<{ items: Organization[] }>(
        showOrgSelector ? "/api/v1/organizations" : null,
        fetcher,
        { fallbackData: { items: [] } }
    )

    // Fetch groups for selected organization
    const { data: groupsData } = useSWR<{ groups: Group[] }>(
        selectedOrgId ? `/api/v1/groups?organizationId=${selectedOrgId}` : null,
        fetcher,
        { fallbackData: { groups: [] } }
    )

    // Fetch products for selected group
    const { data: productsData, isLoading, mutate } = useSWR<{ items: BranchProduct[] }>(
        selectedOrgId && selectedGroupId
            ? `/api/v1/head-office/branch-assignments?organizationId=${selectedOrgId}&groupId=${selectedGroupId}`
            : null,
        fetcher,
        { fallbackData: { items: [] } }
    )

    const branchProducts = productsData?.items ?? []

    // Deduplicate: group by globalProductId so each product appears once
    const deduplicatedProducts = useMemo(() => {
        const productMap = new Map<number, BranchProduct & { branches: string[] }>()

        for (const p of branchProducts) {
            const gpId = (p as any).globalProductId as number
            if (!gpId) continue

            if (productMap.has(gpId)) {
                const existing = productMap.get(gpId)!
                if (p.branchName && !existing.branches.includes(p.branchName)) {
                    existing.branches.push(p.branchName)
                }
                // Keep the earliest assignment date
                if (new Date(p.assignedAt) < new Date(existing.assignedAt)) {
                    existing.assignedAt = p.assignedAt
                }
            } else {
                productMap.set(gpId, {
                    ...p,
                    branches: p.branchName ? [p.branchName] : [],
                })
            }
        }

        return Array.from(productMap.values())
    }, [branchProducts])

    // Search filtering
    const filteredProducts = useMemo(() => {
        if (!searchQuery) return deduplicatedProducts

        const q = searchQuery.toLowerCase()
        return deduplicatedProducts.filter(p =>
            p.productName.toLowerCase().includes(q) ||
            p.productCode.toLowerCase().includes(q) ||
            p.branches.some(b => b.toLowerCase().includes(q))
        )
    }, [deduplicatedProducts, searchQuery])

    const handleGroupChange = (value: string) => {
        setSelectedGroupId(value)
    }

    // Extract unique branch names for the summary at the top
    const allBranches = useMemo(() => {
        const set = new Set<string>()
        for (const p of branchProducts) {
            if (p.branchName) set.add(p.branchName)
        }
        return Array.from(set)
    }, [branchProducts])


    // Removed handleBranchChange as individual branch selection is no longer supported

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <Card className="relative overflow-hidden border-none bg-gradient-to-r from-violet-900 via-purple-900 to-fuchsia-800 text-white shadow-xl">
                <div className="pointer-events-none absolute inset-0 opacity-30">
                    <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-purple-400/40 blur-3xl" />
                </div>
                <CardHeader className="relative space-y-3">
                    <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                        <Eye className="h-4 w-4" />
                        Branch Visibility
                    </p>
                    <CardTitle className="text-3xl font-semibold text-white">View Group Products</CardTitle>
                    <p className="text-sm text-white/80">
                        See which products are assigned to branches within a specific group.
                    </p>
                </CardHeader>
            </Card>

            {/* Selectors */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Select Group</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Organization Selector */}
                    {showOrgSelector && (
                        <div>
                            <label className="text-sm font-medium mb-2 block">Organization</label>
                            <Select value={localOrgId} onValueChange={setLocalOrgId}>
                                <SelectTrigger className="w-full max-w-md">
                                    <SelectValue placeholder="Select organization" />
                                </SelectTrigger>
                                <SelectContent>
                                    {orgsData?.items.map((org) => (
                                        <SelectItem key={org.id} value={org.id.toString()}>
                                            {org.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {contextOrgId && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50/50 dark:bg-violet-950/20">
                            <Building2 className="h-5 w-5 text-violet-600" />
                            <span className="text-sm">Using organization from header.</span>
                        </div>
                    )}

                    {selectedOrgId && (
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Group Selector */}
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                                    <GitBranch className="h-4 w-4" />
                                    Select Group
                                </label>
                                <Select value={selectedGroupId} onValueChange={handleGroupChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(groupsData?.groups || []).map((group) => (
                                            <SelectItem key={group.id} value={group.id.toString()}>
                                                {group.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Branches in this group */}
            {selectedGroupId && allBranches.length > 0 && (
                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardContent className="pt-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Branches in this group ({allBranches.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {allBranches.map((branch) => (
                                <Badge key={branch} variant="secondary" className="text-xs px-3 py-1">
                                    <Building2 className="mr-1.5 h-3 w-3" />
                                    {branch}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Products Table */}
            {selectedGroupId && (
                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="text-xl">Group Products</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Products assigned to branches in the selected group.
                            </p>
                        </div>
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Assigned</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                                Loading products...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredProducts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                                {branchProducts.length === 0
                                                    ? "No products assigned to branches in this group yet."
                                                    : "No products match your search."}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredProducts.map((product) => (
                                            <TableRow key={(product as any).globalProductId || product.id} className="hover:bg-muted/40">
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        {product.productImageUrl ? (
                                                            <img
                                                                src={product.productImageUrl}
                                                                alt={product.productName}
                                                                className="h-10 w-10 rounded-lg border object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/40">
                                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                        <span className="font-medium">{product.customName || product.productName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{product.productCode}</Badge>
                                                </TableCell>

                                                <TableCell className="font-medium">
                                                    {product.customPrice
                                                        ? formatPKR(product.customPrice / 100)
                                                        : <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={product.isActive ? "default" : "secondary"}>
                                                        {product.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {new Date(product.assignedAt).toLocaleDateString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )
            }
        </div >
    )
}
