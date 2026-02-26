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
import { Checkbox } from "@/components/ui/checkbox"
import { formatPKR } from "@/lib/utils"
import { Search, Package, Plus, Building2, GitBranch, Users, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAppContext } from "@/components/context/app-context"
import { Switch } from "@/components/ui/switch"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type Organization = { id: number; name: string }
type Branch = { id: number; name: string; organizationId: number }
type Group = { id: number; name: string; organizationId: number }

type OrgProduct = {
    id: number
    globalProductId: number
    productName: string
    productCode: string
    productImageUrl: string | null
    customPrice: number | null
    customName: string | null
    isActive: boolean
}

export default function AssignToBranchPage() {
    const { toast } = useToast()
    const { organizationId: contextOrgId } = useAppContext()
    const [localOrgId, setLocalOrgId] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")
    // Default to 'all' for status filter
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [selectedProducts, setSelectedProducts] = useState<number[]>([])
    const [assignDialogOpen, setAssignDialogOpen] = useState(false)
    const [selectedGroup, setSelectedGroup] = useState<string>("")
    const [saving, setSaving] = useState(false)
    const [alreadyAssignedBranches, setAlreadyAssignedBranches] = useState<Set<number>>(new Set())
    const [loadingAssignments, setLoadingAssignments] = useState(false)
    const [togglingStatus, setTogglingStatus] = useState<number | null>(null)

    const { userRole } = useAppContext()

    const selectedOrgId = contextOrgId || localOrgId
    const showOrgSelector = !contextOrgId

    // Fetch organizations
    const { data: orgsData } = useSWR<{ items: Organization[] }>(
        showOrgSelector ? "/api/v1/organizations" : null,
        fetcher,
        { fallbackData: { items: [] } }
    )

    // Fetch organization's assigned products
    const { data: productsData, isLoading, mutate } = useSWR<{ items: OrgProduct[] }>(
        selectedOrgId ? `/api/v1/head-office/organization-inventory?organizationId=${selectedOrgId}&status=${statusFilter}&limit=1000` : null,
        fetcher,
        { fallbackData: { items: [] } }
    )

    // Fetch branches for selected organization
    const { data: branchesData } = useSWR<{ items: Branch[] }>(
        selectedOrgId ? `/api/v1/branches?organizationId=${selectedOrgId}` : null,
        fetcher,
        { fallbackData: { items: [] } }
    )

    // Fetch groups for selected organization
    const { data: groupsData } = useSWR<{ groups: Group[] }>(
        selectedOrgId ? `/api/v1/groups?organizationId=${selectedOrgId}` : null,
        fetcher,
        { fallbackData: { groups: [] } }
    )

    // Fetch group branches when a group is selected
    const { data: groupBranchesData } = useSWR<{ branches: Branch[] }>(
        selectedGroup && selectedGroup !== "all" ? `/api/v1/groups/${selectedGroup}/branches` : null,
        fetcher,
        { fallbackData: { branches: [] } }
    )

    const orgProducts = productsData?.items ?? []
    const branches = branchesData?.items ?? []
    const groups = groupsData?.groups ?? []

    // When a group is selected, show only that group's branches (read-only display)
    const branchesToShow = selectedGroup && selectedGroup !== ""
        ? (groupBranchesData?.branches ?? [])
        : []

    // Search filtering
    const filteredProducts = useMemo(() => {
        if (!searchQuery) return orgProducts
        const q = searchQuery.toLowerCase()
        return orgProducts.filter(p =>
            p.productName.toLowerCase().includes(q) ||
            p.productCode.toLowerCase().includes(q)
        )
    }, [orgProducts, searchQuery])

    const handleProductToggle = (productId: number) => {
        setSelectedProducts(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        )
    }

    const handleSelectAll = () => {
        if (selectedProducts.length === filteredProducts.length) {
            setSelectedProducts([])
        } else {
            setSelectedProducts(filteredProducts.map(p => p.id))
        }
    }

    const handleGroupSelect = (groupId: string) => {
        setSelectedGroup(groupId)
    }

    const handleAssign = async () => {
        if (selectedProducts.length === 0) {
            toast({ title: "Error", description: "Please select at least one product", variant: "destructive" })
            return
        }
        if (!selectedGroup) {
            toast({ title: "Error", description: "Please select a group", variant: "destructive" })
            return
        }

        setSaving(true)
        try {
            const res = await fetch("/api/v1/head-office/branch-assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organizationInventoryIds: selectedProducts,
                    groupId: parseInt(selectedGroup),
                    organizationId: parseInt(selectedOrgId as string),
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to assign products")

            toast({
                title: "Success",
                description: data.message || "Successfully assigned products to group",
            })

            // Close and reset
            setAssignDialogOpen(false)
            setSelectedProducts([])
            setSelectedGroup("")
            mutate()
        } catch (error: any) {
            console.error("Assignment error:", error)
            toast({ title: "Error", description: error.message || "Failed to assign products", variant: "destructive" })
        } finally {
            setSaving(false)
        }
    }

    const handleToggleStatus = async (productId: number, currentStatus: boolean) => {
        if (!selectedOrgId) return

        setTogglingStatus(productId)
        try {
            const res = await fetch("/api/v1/head-office/organization-inventory", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: productId,
                    isActive: !currentStatus,
                    organizationId: selectedOrgId
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to update status")

            toast({
                title: "Success",
                description: `Product is now ${!currentStatus ? 'active' : 'inactive'}`,
            })
            mutate()
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            })
        } finally {
            setTogglingStatus(null)
        }
    }


    const openAssignDialog = async () => {
        setSelectedGroup("")
        setAlreadyAssignedBranches(new Set())
        setAssignDialogOpen(true)

        // Fetch existing assignments for selected products
        if (selectedProducts.length > 0 && selectedOrgId) {
            setLoadingAssignments(true)
            try {
                const res = await fetch(`/api/v1/head-office/branch-assignments?organizationId=${selectedOrgId}`)
                const data = await res.json()
                if (res.ok && data.items) {
                    // Find which branches have ANY assignments for the selected products
                    const selectedProductsSet = new Set(selectedProducts.map(id => Number(id)))
                    const assignedBranchIds = new Set<number>()

                    data.items.forEach((item: any) => {
                        const orgInvId = Number(item.organizationInventoryId)
                        const brId = Number(item.branchId)

                        if (selectedProductsSet.has(orgInvId)) {
                            assignedBranchIds.add(brId)
                        }
                    })
                    setAlreadyAssignedBranches(assignedBranchIds)
                }
            } catch (err) {
                console.error('Failed to fetch existing assignments:', err)
            } finally {
                setLoadingAssignments(false)
            }
        }
    }

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <Card className="relative overflow-hidden border-none bg-gradient-to-r from-rose-900 via-pink-900 to-fuchsia-800 text-white shadow-xl">
                <div className="pointer-events-none absolute inset-0 opacity-30">
                    <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-pink-400/40 blur-3xl" />
                </div>
                <CardHeader className="relative space-y-3">
                    <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                        <Plus className="h-4 w-4" />
                        Branch Assignment
                    </p>
                    <CardTitle className="text-3xl font-semibold text-white">Assign Products to Branches</CardTitle>
                    <p className="text-sm text-white/80">
                        Select products assigned to your organization and assign them to specific branches or groups.
                    </p>
                </CardHeader>
            </Card>

            {/* Organization Selector */}
            {showOrgSelector && (
                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Select Organization</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                    </CardContent>
                </Card>
            )}

            {contextOrgId && (
                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-rose-50/50 dark:bg-rose-950/20">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-rose-600" />
                            <span className="text-sm">Using organization from header.</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Products Table */}
            {selectedOrgId && (
                <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="text-xl">Organization Products</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Select products to assign to branches. Only products assigned to your organization are listed.
                            </p>
                        </div>
                        <div className="flex flex-col gap-4 w-full lg:flex-row lg:items-center lg:justify-end lg:w-auto">
                            <div className="relative w-full lg:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search products..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="w-full lg:w-48">
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="active">Active Only</SelectItem>
                                        <SelectItem value="inactive">Inactive Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                onClick={openAssignDialog}
                                disabled={selectedProducts.length === 0}
                                className="gap-2"
                            >
                                <GitBranch className="h-4 w-4" />
                                Assign to Group ({selectedProducts.length})
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Status</TableHead>
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
                                                {orgProducts.length === 0
                                                    ? "No products assigned to this organization yet."
                                                    : "No products match your search."}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredProducts.map((product) => (
                                            <TableRow
                                                key={product.id}
                                                className={`hover:bg-muted/40 cursor-pointer ${selectedProducts.includes(product.id) ? "bg-rose-50/50 dark:bg-rose-950/20" : ""}`}
                                                onClick={() => handleProductToggle(product.id)}
                                            >
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={selectedProducts.includes(product.id)}
                                                        onCheckedChange={() => handleProductToggle(product.id)}
                                                    />
                                                </TableCell>
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
                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                        {userRole === "SUPER_ADMIN" ? (
                                                            <>
                                                                <Switch
                                                                    disabled={togglingStatus === product.id}
                                                                    checked={product.isActive}
                                                                    onCheckedChange={() => handleToggleStatus(product.id, product.isActive)}
                                                                />
                                                                {togglingStatus === product.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                                <span className="text-xs font-medium min-w-[50px]">
                                                                    {product.isActive ? "Active" : "Inactive"}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <Badge variant={product.isActive ? "default" : "secondary"}>
                                                                {product.isActive ? "Active" : "Inactive"}
                                                            </Badge>
                                                        )}
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
            )}

            {/* Assign Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Assign to Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Assigning {selectedProducts.length} product(s) to a group. All branches in the selected group will be assigned.
                        </p>

                        {/* Group selection */}
                        <div>
                            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Select Group
                            </label>
                            <Select value={selectedGroup} onValueChange={handleGroupSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a group to assign products" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.length === 0 ? (
                                        <div className="py-2 px-3 text-sm text-muted-foreground">No groups available</div>
                                    ) : (
                                        groups.map((group) => (
                                            <SelectItem key={group.id} value={group.id.toString()}>
                                                {group.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Branch display (read-only) */}
                        {selectedGroup && (
                            <div>
                                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    Branches in Selected Group
                                </label>
                                {loadingAssignments ? (
                                    <div className="text-sm text-muted-foreground p-3">Loading existing assignments...</div>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto border rounded-lg p-3 space-y-2 bg-muted/20">
                                        {branchesToShow.map((branch) => {
                                            const branchIdNum = Number(branch.id)
                                            const isAlreadyAssigned = alreadyAssignedBranches.has(branchIdNum)

                                            return (
                                                <div key={branch.id} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`branch-${branch.id}`}
                                                        checked={true}
                                                        disabled={true}
                                                    />
                                                    <label
                                                        className="text-sm flex items-center gap-2 cursor-default"
                                                    >
                                                        {branch.name}
                                                        {isAlreadyAssigned && (
                                                            <Badge variant="secondary" className="text-xs">Already Assigned</Badge>
                                                        )}
                                                    </label>
                                                </div>
                                            )
                                        })}
                                        {branchesToShow.length === 0 && (
                                            <p className="text-sm text-muted-foreground">No branches in this group.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssign}
                            disabled={
                                saving ||
                                !selectedGroup ||
                                branchesToShow.length === 0 ||
                                branchesToShow.every(b => alreadyAssignedBranches.has(Number(b.id)))
                            }
                        >
                            {saving ? "Assigning..." :
                                branchesToShow.length === 0 ? "No Branches in Group" :
                                    branchesToShow.every(b => alreadyAssignedBranches.has(Number(b.id)))
                                        ? "Already Fully Assigned"
                                        : "Assign to Group"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
