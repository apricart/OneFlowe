"use client"
import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Search, Sparkles, Plus, Edit, Trash2, FolderOpen, Package, Loader2, FolderTree } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type Category = {
    id: number
    name: string
}

type Subcategory = {
    id: number
    name: string
    parentId: number
    categoryName: string
    productsCount: number
    createdAt: string
    updatedAt: string
}

export default function SubcategoriesPage() {
    const { toast } = useToast()
    const [searchQuery, setSearchQuery] = useState("")
    const [categoryFilter, setCategoryFilter] = useState<string>("")

    // Dialog state
    const [dialogMode, setDialogMode] = useState<"create" | "edit" | "delete" | null>(null)
    const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null)
    const [subcategoryName, setSubcategoryName] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Fetch categories for dropdown
    const { data: categoriesData } = useSWR<{ items: Category[] }>(
        `/api/v1/categories`,
        fetcher,
        { fallbackData: { items: [] } }
    )
    const categories = categoriesData?.items ?? []

    // Fetch subcategories
    const params = new URLSearchParams()
    if (searchQuery) params.set("search", searchQuery)
    if (categoryFilter) params.set("categoryId", categoryFilter)

    const { data, isLoading, mutate } = useSWR<{
        items: Subcategory[]
        pagination: { page: number; limit: number; total: number; pages: number }
    }>(`/api/v1/subcategories?${params.toString()}`, fetcher, {
        fallbackData: { items: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } },
        revalidateOnFocus: false,
    })

    const subcategories = data?.items ?? []
    const totalSubcategories = data?.pagination.total ?? 0

    const openCreateDialog = () => {
        setSubcategoryName("")
        setSelectedCategoryId("")
        setSelectedSubcategory(null)
        setDialogMode("create")
    }

    const openEditDialog = (subcategory: Subcategory) => {
        setSubcategoryName(subcategory.name)
        setSelectedCategoryId(subcategory.parentId.toString())
        setSelectedSubcategory(subcategory)
        setDialogMode("edit")
    }

    const openDeleteDialog = (subcategory: Subcategory) => {
        setSelectedSubcategory(subcategory)
        setDialogMode("delete")
    }

    const closeDialog = () => {
        setDialogMode(null)
        setSelectedSubcategory(null)
        setSubcategoryName("")
        setSelectedCategoryId("")
        setIsSubmitting(false)
    }

    const handleCreate = async () => {
        if (!subcategoryName.trim() || !selectedCategoryId) {
            toast({ title: "Error", description: "Name and category are required", variant: "destructive" })
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/v1/subcategories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: subcategoryName.trim(),
                    categoryId: parseInt(selectedCategoryId)
                }),
            })
            const data = await res.json()

            if (res.ok) {
                toast({ title: "Success", description: "Subcategory created successfully" })
                mutate()
                closeDialog()
            } else {
                toast({ title: "Error", description: data.error || "Failed to create subcategory", variant: "destructive" })
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to create subcategory", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = async () => {
        if (!selectedSubcategory || !subcategoryName.trim() || !selectedCategoryId) {
            toast({ title: "Error", description: "Name and category are required", variant: "destructive" })
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/v1/subcategories", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedSubcategory.id,
                    name: subcategoryName.trim(),
                    categoryId: parseInt(selectedCategoryId)
                }),
            })
            const data = await res.json()

            if (res.ok) {
                toast({ title: "Success", description: "Subcategory updated successfully" })
                mutate()
                closeDialog()
            } else {
                toast({ title: "Error", description: data.error || "Failed to update subcategory", variant: "destructive" })
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to update subcategory", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!selectedSubcategory) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/v1/subcategories?id=${selectedSubcategory.id}`, {
                method: "DELETE",
            })
            const data = await res.json()

            if (res.ok) {
                toast({ title: "Success", description: "Subcategory deleted successfully" })
                mutate()
                closeDialog()
            } else {
                toast({ title: "Cannot Delete", description: data.error, variant: "destructive" })
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete subcategory", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-8 p-6" suppressHydrationWarning>
            {/* Header */}
            <Card className="relative overflow-hidden border-none bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-800 text-white shadow-xl">
                <div className="pointer-events-none absolute inset-0 opacity-30">
                    <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-pink-400/40 blur-3xl" />
                </div>
                <CardHeader className="relative space-y-3">
                    <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                        <Sparkles className="h-4 w-4" />
                        Product Organization
                    </p>
                    <CardTitle className="text-3xl font-semibold text-white">Subcategory Management</CardTitle>
                    <p className="text-sm text-white/80">
                        Subcategories help organize products within categories for more granular organization.
                    </p>
                </CardHeader>
            </Card>

            {/* Main Content */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="text-xl text-slate-900 dark:text-white">Subcategories</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {totalSubcategories} {totalSubcategories === 1 ? "subcategory" : "subcategories"} in total
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 w-full lg:flex-row lg:items-center lg:justify-end lg:w-auto">
                        <div className="relative w-full lg:w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
                            <SelectTrigger className="w-full lg:w-48">
                                <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All categories</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id.toString()}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button className="gap-2" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4" />
                            Create Subcategory
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Products</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                            Loading subcategories…
                                        </TableCell>
                                    </TableRow>
                                ) : subcategories.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                            {searchQuery || categoryFilter
                                                ? "No subcategories found matching your filters."
                                                : "No subcategories yet. Create your first subcategory to organize products."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    subcategories.map((subcategory) => (
                                        <TableRow key={subcategory.id} className="hover:bg-muted/40">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                                                        <FolderOpen className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900 dark:text-white">{subcategory.name}</p>
                                                        <p className="text-xs text-muted-foreground">ID: {subcategory.id}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="gap-1">
                                                    <FolderTree className="h-3 w-3" />
                                                    {subcategory.categoryName}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-sm">{subcategory.productsCount} products</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(subcategory.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => openEditDialog(subcategory)}
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                        onClick={() => openDeleteDialog(subcategory)}
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

            {/* Create/Edit Dialog */}
            <Dialog open={dialogMode === "create" || dialogMode === "edit"} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{dialogMode === "create" ? "Create Subcategory" : "Edit Subcategory"}</DialogTitle>
                        <DialogDescription>
                            {dialogMode === "create"
                                ? "Add a new subcategory under a parent category."
                                : "Update the subcategory details."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Parent Category *</label>
                            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Subcategory Name *</label>
                            <Input
                                value={subcategoryName}
                                onChange={(e) => setSubcategoryName(e.target.value)}
                                placeholder="Enter subcategory name"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !isSubmitting) {
                                        dialogMode === "create" ? handleCreate() : handleEdit()
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={dialogMode === "create" ? handleCreate : handleEdit}
                            disabled={isSubmitting || !subcategoryName.trim() || !selectedCategoryId}
                        >
                            {dialogMode === "create" ? "Create" : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={dialogMode === "delete"} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete Subcategory</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{selectedSubcategory?.name}"?
                            {selectedSubcategory && selectedSubcategory.productsCount > 0 && (
                                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                                    ⚠️ This subcategory has {selectedSubcategory.productsCount} product(s).
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isSubmitting}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
