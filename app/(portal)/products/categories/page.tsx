"use client"
import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Search, Sparkles, Plus, Edit, Trash2, FolderTree, Package, Loader2, FolderOpen } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type Category = {
    id: number
    name: string
    subcategoriesCount: number
    productsCount: number
    createdAt: string
    updatedAt: string
}

export default function CategoriesPage() {
    const { toast } = useToast()
    const [searchQuery, setSearchQuery] = useState("")

    // Dialog state
    const [dialogMode, setDialogMode] = useState<"create" | "edit" | "delete" | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
    const [categoryName, setCategoryName] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const params = new URLSearchParams()
    if (searchQuery) params.set("search", searchQuery)

    const { data, isLoading, mutate } = useSWR<{
        items: Category[]
        pagination: { page: number; limit: number; total: number; pages: number }
    }>(`/api/v1/categories?${params.toString()}`, fetcher, {
        fallbackData: { items: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } },
        revalidateOnFocus: false,
    })

    const categories = data?.items ?? []
    const totalCategories = data?.pagination.total ?? 0

    const openCreateDialog = () => {
        setCategoryName("")
        setSelectedCategory(null)
        setDialogMode("create")
    }

    const openEditDialog = (category: Category) => {
        setCategoryName(category.name)
        setSelectedCategory(category)
        setDialogMode("edit")
    }

    const openDeleteDialog = (category: Category) => {
        setSelectedCategory(category)
        setDialogMode("delete")
    }

    const closeDialog = () => {
        setDialogMode(null)
        setSelectedCategory(null)
        setCategoryName("")
        setIsSubmitting(false)
    }

    const handleCreateCategory = async () => {
        if (!categoryName.trim()) {
            toast({ title: "Error", description: "Category name is required", variant: "destructive" })
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/v1/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: categoryName.trim() }),
            })
            const data = await res.json()

            if (res.ok) {
                toast({ title: "Success", description: "Category created successfully" })
                mutate()
                closeDialog()
            } else {
                toast({ title: "Error", description: data.error || "Failed to create category", variant: "destructive" })
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to create category", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEditCategory = async () => {
        if (!selectedCategory || !categoryName.trim()) {
            toast({ title: "Error", description: "Category name is required", variant: "destructive" })
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/v1/categories", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: selectedCategory.id, name: categoryName.trim() }),
            })
            const data = await res.json()

            if (res.ok) {
                toast({ title: "Success", description: "Category updated successfully" })
                mutate()
                closeDialog()
            } else {
                toast({ title: "Error", description: data.error || "Failed to update category", variant: "destructive" })
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to update category", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteCategory = async () => {
        if (!selectedCategory) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/v1/categories?id=${selectedCategory.id}`, {
                method: "DELETE",
            })
            const data = await res.json()

            if (res.ok) {
                toast({ title: "Success", description: "Category deleted successfully" })
                mutate()
                closeDialog()
            } else {
                toast({ title: "Cannot Delete", description: data.error, variant: "destructive" })
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete category", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-8 p-6" suppressHydrationWarning>
            <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-800 text-white shadow-xl">
                <div className="pointer-events-none absolute inset-0 opacity-30">
                    <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
                </div>
                <CardHeader className="relative space-y-3">
                    <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                        <Sparkles className="h-4 w-4" />
                        Product Organization
                    </p>
                    <CardTitle className="text-3xl font-semibold text-white">Category Management</CardTitle>
                    <p className="text-sm text-white/80">
                        Create and manage product categories. Categories contain subcategories which organize products.
                    </p>
                </CardHeader>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <CardTitle className="text-xl text-slate-900 dark:text-white">Categories</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {totalCategories} {totalCategories === 1 ? "category" : "categories"} in total
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 w-full lg:flex-row lg:items-center lg:justify-end lg:w-auto">
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search categories"
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button className="gap-2" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4" />
                            Create Category
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Subcategories</TableHead>
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
                                            Loading categories…
                                        </TableCell>
                                    </TableRow>
                                ) : categories.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                            {searchQuery
                                                ? "No categories found matching your search."
                                                : "No categories yet. Create your first category to organize products."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    categories.map((category) => (
                                        <TableRow key={category.id} className="hover:bg-muted/40">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                                                        <FolderTree className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900 dark:text-white">{category.name}</p>
                                                        <p className="text-xs text-muted-foreground">ID: {category.id}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="gap-1">
                                                    <FolderOpen className="h-3 w-3" />
                                                    {category.subcategoriesCount}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-sm">{category.productsCount}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(category.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => openEditDialog(category)}
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                        onClick={() => openDeleteDialog(category)}
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
                        <DialogTitle>{dialogMode === "create" ? "Create Category" : "Edit Category"}</DialogTitle>
                        <DialogDescription>
                            {dialogMode === "create"
                                ? "Add a new category to organize your products."
                                : "Update the category name."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Category Name</label>
                            <Input
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                placeholder="Enter category name"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !isSubmitting) {
                                        dialogMode === "create" ? handleCreateCategory() : handleEditCategory()
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
                            onClick={dialogMode === "create" ? handleCreateCategory : handleEditCategory}
                            disabled={isSubmitting || !categoryName.trim()}
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
                        <DialogTitle className="text-destructive">Delete Category</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{selectedCategory?.name}"?
                            {selectedCategory && (selectedCategory.subcategoriesCount > 0 || selectedCategory.productsCount > 0) && (
                                <span className="block mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-sm">
                                    ⚠️ This category has{" "}
                                    {selectedCategory.subcategoriesCount > 0 && (
                                        <strong>{selectedCategory.subcategoriesCount} subcategor{selectedCategory.subcategoriesCount > 1 ? "ies" : "y"}</strong>
                                    )}
                                    {selectedCategory.subcategoriesCount > 0 && selectedCategory.productsCount > 0 && " and "}
                                    {selectedCategory.productsCount > 0 && (
                                        <strong>{selectedCategory.productsCount} product{selectedCategory.productsCount > 1 ? "s" : ""}</strong>
                                    )}
                                    . You must remove them first.
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
                            onClick={handleDeleteCategory}
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
